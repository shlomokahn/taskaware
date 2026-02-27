import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    KeyboardAvoidingView,
    Platform,
    Modal,
    Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useLocationSync } from './src/useLocationSync.js';

import TaskDetailModal from './src/components/TaskDetailModal';
import EditTask from './src/EditTask';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

import * as Device from 'expo-device';
import Constants from 'expo-constants';

// הגדרת התנהגות התראות כשהאפליקציה פתוחה
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

const API_BASE = 'https://taskaware-backend.onrender.com';

export default function App() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // סטייט ליצירת משימה
    const [newTitle, setNewTitle] = useState('');
    const [dueDate, setDueDate] = useState(new Date());
    const [creating, setCreating] = useState(false);
    const [isSmartTask, setIsSmartTask] = useState(false); // הסטייט החדש ל-AI

    const [showIOSPicker, setShowIOSPicker] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [editingTask, setEditingTask] = useState(null);

    // התחברות
    const [token, setToken] = useState(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoginMode, setIsLoginMode] = useState(true);
    const [isAuthLoading, setIsAuthLoading] = useState(false);

    const { location } = useLocationSync(API_BASE, token);

    // --- 1. ניהול התראות ---
    useEffect(() => {
        async function setupPushNotifications() {
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'Task Reminders',
                    importance: Notifications.AndroidImportance.HIGH,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            }

            if (Device.isDevice) {
                const { status: existingStatus } = await Notifications.getPermissionsAsync();
                let finalStatus = existingStatus;

                if (existingStatus !== 'granted') {
                    const { status } = await Notifications.requestPermissionsAsync();
                    finalStatus = status;
                }

                if (finalStatus !== 'granted') return;

                if (token) {
                    try {
                        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
                        const pushTokenString = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
                        await fetch(`${API_BASE}/api/save-push-token/`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                            body: JSON.stringify({ token: pushTokenString }),
                        });
                    } catch (error) { console.error("Error getting or sending push token:", error); }
                }
            }
        }
        setupPushNotifications();
    }, [token]);

    const scheduleNotification = async (taskTitle, date) => {
        const triggerTime = new Date(date).getTime();
        const now = Date.now();
        if (triggerTime <= now) return null;

        try {
            const id = await Notifications.scheduleNotificationAsync({
                content: { title: "תזכורת למשימה! 🔔", body: taskTitle, sound: true, priority: Notifications.AndroidNotificationPriority.HIGH },
                trigger: { date: triggerTime, channelId: 'default' },
            });
            return id;
        } catch (e) { return null; }
    };

    const cancelNotification = async (notifId) => {
        if (notifId) await Notifications.cancelScheduledNotificationAsync(notifId);
    };

    // --- 2. בחירת תאריך ---
    const showAndroidPicker = () => {
        DateTimePickerAndroid.open({
            value: dueDate, mode: 'date', display: 'calendar',
            onChange: (event, selectedDate) => {
                if (event.type === 'set' && selectedDate) {
                    DateTimePickerAndroid.open({
                        value: selectedDate, mode: 'time', is24Hour: true, display: 'clock',
                        onChange: (timeEvent, finalDate) => {
                            if (timeEvent.type === 'set' && finalDate) setDueDate(finalDate);
                        },
                    });
                }
            },
        });
    };

    // --- 3. לוגיקה של משימות ---
    const fetchTasks = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE}/api/tasks/`, { headers: { 'Authorization': `Token ${token}` } });
            const data = await res.json();
            setTasks(Array.isArray(data) ? data : []);
        } catch (err) { console.log('Fetch error:', err); }
        finally { setLoading(false); setRefreshing(false); }
    }, [token]);

    useEffect(() => {
        (async () => {
            const savedToken = await AsyncStorage.getItem('userToken');
            if (savedToken) setToken(savedToken);
            setLoading(false);
        })();
    }, []);

    useEffect(() => { if (token) fetchTasks(); }, [token, fetchTasks]);

    // הפונקציה האמיתית שמדברת עם השרת שלך (Django) שמדבר עם Gemini
    const fetchLocationFromAI = async (taskTitle) => {
        try {
            console.log(`שולח ל-AI בקשה למיקום עבור: ${taskTitle}...`);
            const res = await fetch(`${API_BASE}/api/ask-ai/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}` // שולח את הטוקן של המשתמש לאימות
                },
                body: JSON.stringify({ title: taskTitle }),
            });

            if (!res.ok) {
                console.error("שגיאה מהשרת:", await res.text());
                return null;
            }

            const data = await res.json();
            if (data.locationQuery) {
                return data.locationQuery;
            }
            return null;
        } catch (error) {
            console.error("שגיאה בקבלת מיקום מה-AI:", error);
            return null;
        }
    };

    const createTask = async () => {
        const title = newTitle.trim();
        if (!title || !token) return;

        setCreating(true);
        try {
            let suggestedLocation = '';

            // בודק אם המשתמש סימן שזו משימה חכמה
            if (isSmartTask) {
                suggestedLocation = await fetchLocationFromAI(title);
                if (suggestedLocation) {
                    console.log(`ה-AI מציע לבצע את זה ב: ${suggestedLocation}`);
                }
            }

            const notifId = await scheduleNotification(title, dueDate);

            // שמירת המשימה במסד הנתונים
            const res = await fetch(`${API_BASE}/api/tasks/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                body: JSON.stringify({
                    title,
                    dueDate: dueDate.toISOString(),
                    notificationId: notifId,
                    locationQuery: suggestedLocation // שומרים את המיקום ב-DB
                }),
            });

            if (!res.ok) {
                throw new Error("נכשל בשמירת המשימה");
            }

            const created = await res.json();
            setTasks(prev => [created, ...prev]);

            // איפוס השדות
            setNewTitle('');
            setDueDate(new Date());
            setIsSmartTask(false);

        } catch (err) {
            Alert.alert("שגיאה", "שגיאה בשמירת המשימה");
            console.error(err);
        } finally {
            setCreating(false);
        }
    };

    const handleUpdateTask = async (taskId, fields) => {
        try {
            const res = await fetch(`${API_BASE}/api/tasks/${taskId}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                body: JSON.stringify(fields),
            });
            const updated = await res.json();
            setTasks(prev => prev.map(t => t._id === taskId ? updated : t));
            return updated;
        } catch (err) { console.error(err); }
    };

    const formatDisplayDate = (date) => {
        if (!date) return 'בחר תאריך';
        const d = new Date(date);
        return isNaN(d.getTime()) ? 'תאריך לא תקין' : d.toLocaleString('he-IL', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });
    };

    // --- 4. מסך התחברות ---
    if (!token) {
        return (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.loginContainer}>
                <View style={styles.loginCard}>
                    <Text style={styles.loginBrand}>TaskAware</Text>
                    <TextInput style={styles.loginInput} placeholder="שם משתמש" value={username} onChangeText={setUsername} autoCapitalize="none" />
                    <TextInput style={styles.loginInput} placeholder="סיסמה" secureTextEntry value={password} onChangeText={setPassword} />
                    <TouchableOpacity
                        style={styles.loginBtn} disabled={isAuthLoading}
                        onPress={async () => {
                            if (!username || !password) { Alert.alert("שגיאה", "אנא הזן שם משתמש וסיסמה"); return; }
                            setIsAuthLoading(true);
                            const path = isLoginMode ? '/api/login/' : '/api/signup/'; // חשוב: לוודא לוכסן בסוף ב-Django
                            try {
                                const res = await fetch(`${API_BASE}${path}`, {
                                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ username, password }),
                                });
                                const data = await res.json();
                                if (data.token) {
                                    await AsyncStorage.setItem('userToken', data.token);
                                    setToken(data.token);
                                } else { Alert.alert("שגיאה", "פרטי התחברות שגויים"); }
                            } catch (e) { Alert.alert("שגיאה", "חיבור לשרת נכשל"); }
                            finally { setIsAuthLoading(false); }
                        }}
                    >
                        {isAuthLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>{isLoginMode ? 'כניסה' : 'הרשמה'}</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setIsLoginMode(!isLoginMode)}>
                        <Text style={styles.switchModeText}>{isLoginMode ? 'אין לך חשבון? עבור להרשמה' : 'יש לך חשבון? עבור להתחברות'}</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        );
    }

    // --- 5. המסך הראשי של המשימות ---
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.brand}>TaskAware</Text>
                <TouchableOpacity style={styles.logoutBtn} onPress={() => { AsyncStorage.removeItem('userToken'); setToken(null); }}>
                    <Text style={styles.logoutText}>יציאה</Text>
                </TouchableOpacity>
            </View>

            {/* כרטיסיית הוספת משימה חדשה */}
            <View style={styles.inputContainer}>
                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.taskInput}
                        placeholder="מה המשימה הבאה שלך?"
                        value={newTitle}
                        onChangeText={setNewTitle}
                        placeholderTextColor="#9ca3af"
                    />

                    {/* כפתור משימה חכמה */}
                    <TouchableOpacity
                        style={[styles.smartBtn, isSmartTask && styles.smartBtnActive]}
                        onPress={() => setIsSmartTask(!isSmartTask)}
                    >
                        <Text style={[styles.smartBtnText, isSmartTask && styles.smartBtnTextActive]}>✨ AI</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.datePickerBtn} onPress={() => Platform.OS === 'android' ? showAndroidPicker() : setShowIOSPicker(true)}>
                        <Text style={{ fontSize: 22 }}>📅</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.actionRow}>
                    <Text style={styles.dateInfo}>מיועד ל: {formatDisplayDate(dueDate)}</Text>
                    <TouchableOpacity style={styles.addBtn} onPress={createTask} disabled={creating}>
                        {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.addBtnText}>הוסף משימה +</Text>}
                    </TouchableOpacity>
                </View>
            </View>

            {/* iOS Picker Modal */}
            {Platform.OS === 'ios' && showIOSPicker && (
                <Modal transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                        <View style={styles.pickerContainer}>
                            <TouchableOpacity style={{ alignSelf: 'flex-end', padding: 10 }} onPress={() => setShowIOSPicker(false)}>
                                <Text style={{ color: 'blue', fontWeight: 'bold' }}>סיום</Text>
                            </TouchableOpacity>
                            <DateTimePicker value={dueDate} mode="datetime" display="spinner" onChange={(e, d) => d && setDueDate(d)} />
                        </View>
                    </View>
                </Modal>
            )}

            {/* רשימת המשימות */}
            <Text style={styles.listTitle}>המשימות שלי</Text>
            <FlatList
                data={tasks}
                contentContainerStyle={{ paddingBottom: 20 }}
                keyExtractor={(item) => (item._id || item.id)?.toString()}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>אין לך משימות כרגע. איזה כיף! 🎉</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[styles.taskRow, item.isCompleted && styles.taskRowCompleted]}
                        onPress={() => setSelectedTask(item)}
                    >
                        {/* התוכן של המשימה */}
                        <View style={styles.taskContent}>
                            <Text style={[styles.taskTitle, item.isCompleted && styles.taskTitleCompleted]}>{item.title}</Text>
                            <Text style={styles.taskDate}>⏰ {formatDisplayDate(item.dueDate)}</Text>
                            {/* אפשר להציג את המיקום אם הוא קיים */}
                            {item.locationQuery && (
                                <Text style={styles.taskLocation}>📍 מומלץ לבצע ב: {item.locationQuery}</Text>
                            )}
                        </View>

                        {/* עיגול סטטוס למשימה */}
                        <View style={[styles.statusCircle, item.isCompleted && styles.statusCircleCompleted]}>
                            {item.isCompleted && <Text style={styles.checkMark}>✓</Text>}
                        </View>
                    </TouchableOpacity>
                )}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchTasks} />}
            />

            <TaskDetailModal
                visible={!!selectedTask}
                task={selectedTask}
                onClose={() => setSelectedTask(null)}
                onToggle={async (task) => {
                    const newStatus = !task.isCompleted;
                    if (newStatus) await cancelNotification(task.notificationId);
                    await handleUpdateTask(task._id || task.id, { isCompleted: newStatus });
                    setSelectedTask(null);
                }}
                onDelete={async (id) => {
                    if (selectedTask?.notificationId) await cancelNotification(selectedTask.notificationId);
                    await fetch(`${API_BASE}/api/tasks/${id}/`, { method: 'DELETE', headers: { 'Authorization': `Token ${token}` } });
                    setTasks(prev => prev.filter(t => (t._id || t.id) !== id));
                    setSelectedTask(null);
                }}
                onEdit={(task) => { setEditingTask(task); setSelectedTask(null); }}
            />

            <EditTask
                visible={!!editingTask}
                task={editingTask}
                onClose={() => setEditingTask(null)}
                onSave={async (id, title) => { await handleUpdateTask(id, { title }); setEditingTask(null); }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    // התחברות
    loginContainer: { flex: 1, justifyContent: 'center', backgroundColor: '#f3f4f6', paddingHorizontal: 20 },
    loginCard: { backgroundColor: '#fff', padding: 25, borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 5 },
    loginBrand: { fontSize: 36, fontWeight: '900', textAlign: 'center', marginBottom: 30, color: '#2f855a' },
    loginInput: { height: 55, backgroundColor: '#f9fafb', borderRadius: 16, paddingHorizontal: 15, marginBottom: 15, borderWidth: 1, borderColor: '#e5e7eb', textAlign: 'right', fontSize: 16 },
    loginBtn: { height: 55, backgroundColor: '#2f855a', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: '#2f855a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 },
    loginBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    switchModeText: { textAlign: 'center', marginTop: 20, color: '#4b5563', fontSize: 15, fontWeight: '600' },

    // מסך ראשי
    container: { flex: 1, paddingTop: 60, paddingHorizontal: 20, backgroundColor: '#f3f4f6' },
    header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    brand: { fontSize: 32, fontWeight: '900', color: '#111827' },
    logoutBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    logoutText: { color: '#ef4444', fontWeight: 'bold', fontSize: 14 },

    // הוספת משימה
    inputContainer: { backgroundColor: '#fff', padding: 20, borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, marginBottom: 30 },
    inputRow: { flexDirection: 'row-reverse', gap: 12, marginBottom: 15 },
    taskInput: { flex: 1, height: 55, backgroundColor: '#f9fafb', borderRadius: 16, paddingHorizontal: 15, borderWidth: 1, borderColor: '#e5e7eb', textAlign: 'right', fontSize: 16, color: '#1f2937' },
    datePickerBtn: { width: 55, height: 55, backgroundColor: '#f3f4f6', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },

    // עיצוב כפתור AI
    smartBtn: { width: 55, height: 55, backgroundColor: '#f3f4f6', borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
    smartBtnActive: { backgroundColor: '#fdf4ff', borderColor: '#d946ef' },
    smartBtnText: { fontSize: 14, fontWeight: 'bold', color: '#9ca3af' },
    smartBtnTextActive: { color: '#d946ef' },

    actionRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
    dateInfo: { fontSize: 14, color: '#4b5563', fontWeight: '600' },
    addBtn: { backgroundColor: '#2f855a', paddingHorizontal: 20, height: 45, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    addBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

    // רשימת משימות
    listTitle: { fontSize: 20, fontWeight: '800', color: '#374151', textAlign: 'right', marginBottom: 15 },
    taskRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 18, borderRadius: 20, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2, borderWidth: 1, borderColor: 'transparent' },
    taskRowCompleted: { backgroundColor: '#f9fafb', borderColor: '#e5e7eb', elevation: 0 },
    taskContent: { flex: 1, paddingRight: 15 },
    taskTitle: { fontSize: 17, fontWeight: '700', color: '#1f2937', textAlign: 'right', marginBottom: 6 },
    taskTitleCompleted: { textDecorationLine: 'line-through', color: '#9ca3af' },
    taskDate: { fontSize: 13, color: '#6b7280', textAlign: 'right', marginBottom: 2 },
    taskLocation: { fontSize: 13, color: '#8b5cf6', textAlign: 'right', fontWeight: '600' },

    // מעגל סטטוס סיום
    statusCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
    statusCircleCompleted: { backgroundColor: '#2f855a', borderColor: '#2f855a' },
    checkMark: { color: '#fff', fontSize: 16, fontWeight: '900' },

    // מצב ריק ו-Modal
    emptyState: { alignItems: 'center', marginTop: 40 },
    emptyStateText: { fontSize: 16, color: '#9ca3af', fontWeight: '600' },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    pickerContainer: { backgroundColor: 'white', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 }
});