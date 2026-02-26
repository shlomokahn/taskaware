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
        shouldShowBanner: true, // מקפיץ את ההתראה למעלה (מחליף את shouldShowAlert)
        shouldShowList: true,   // מציג במרכז ההתראות
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

const API_BASE = 'https://taskaware-backend.onrender.com';

export default function App() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [creating, setCreating] = useState(false);

    const [dueDate, setDueDate] = useState(new Date());
    const [showIOSPicker, setShowIOSPicker] = useState(false);

    const [selectedTask, setSelectedTask] = useState(null);
    const [editingTask, setEditingTask] = useState(null);
    const [token, setToken] = useState(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoginMode, setIsLoginMode] = useState(true);

    const { location } = useLocationSync(API_BASE, token);
    useEffect(() => {
        (async () => {
            // 1. הגדרת ערוץ באנדרואיד (כמו מקודם)
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'Task Reminders',
                    importance: Notifications.AndroidImportance.HIGH,
                });
            }

            // 2. בדיקה שאנחנו על מכשיר אמיתי (פוש לא עובד על סימולטור של אפל, ובאנדרואיד מומלץ מכשיר אמיתי)
            if (Device.isDevice) {
                const { status: existingStatus } = await Notifications.getPermissionsAsync();
                let finalStatus = existingStatus;

                if (existingStatus !== 'granted') {
                    const { status } = await Notifications.requestPermissionsAsync();
                    finalStatus = status;
                }

                if (finalStatus !== 'granted') {
                    console.log('Failed to get push token for push notification!');
                    return;
                }

                try {
                    // יצירת הטוקן משרתי Expo
                    // הערה: אם אתה מקבל שגיאה שחסר projectId, הוסף אותו בתוך האובייקט כאן
                    const pushTokenString = (await Notifications.getExpoPushTokenAsync()).data;
                    console.log("My Expo Push Token:", pushTokenString);

                    // 3. אם יש לנו משתמש מחובר (token של השרת שלנו), נשלח לו את הטוקן של Expo
                    if (token) {
                        await fetch(`${API_BASE}/api/save-push-token/`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Token ${token}`
                            },
                            body: JSON.stringify({ token: pushTokenString }),
                        });
                        console.log("Push token sent to Django successfully!");
                    }
                } catch (error) {
                    console.error("Error getting or sending push token:", error);
                }
            } else {
                console.log('Must use physical device for Push Notifications');
            }
        })();
    }, [token]);
    // --- 1. ניהול התראות ---

    useEffect(() => {
        (async () => {
            // בקשת הרשאה
            const { status } = await Notifications.requestPermissionsAsync();
            if (status !== 'granted') {
                console.log('Notification permissions denied');
            }

            // יצירת ערוץ התראות (קריטי לאנדרואיד)
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'Task Reminders',
                    importance: Notifications.AndroidImportance.HIGH,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            }
        })();
    }, []);

    const scheduleNotification = async (taskTitle, date) => {
        // 1. הופכים את התאריך למספר טהור (Timestamp) - זה מונע מאנדרואיד להתבלבל ולחשוב שהתאריך בעבר
        const triggerTime = new Date(date).getTime();
        const now = Date.now();

        // 2. מוודאים שלא בחרנו תאריך/שעה שעברו
        if (triggerTime <= now) {
            console.log("Date is in the past, skipping notification");
            return null;
        }

        try {
            const id = await Notifications.scheduleNotificationAsync({
                content: {
                    title: "תזכורת למשימה! 🔔",
                    body: taskTitle,
                    sound: true,
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                },
                // 3. משתמשים במספר הטהור (date) יחד עם הערוץ שיצרנו (channelId)
                trigger: {
                    date: triggerTime,
                    channelId: 'default',
                },
            });
            console.log(`Notification scheduled accurately for timestamp: ${triggerTime}. ID: ${id}`);
            return id;
        } catch (e) {
            console.error("Failed to schedule notification:", e);
            return null;
        }
    };

    const cancelNotification = async (notifId) => {
        if (notifId) {
            await Notifications.cancelScheduledNotificationAsync(notifId);
        }
    };

    // --- 2. בחירת תאריך ושעה (אנדרואיד) ---

    const showAndroidPicker = () => {
        // שלב א': בחירת תאריך
        DateTimePickerAndroid.open({
            value: dueDate,
            mode: 'date',
            display: 'calendar',
            onChange: (event, selectedDate) => {
                if (event.type === 'set' && selectedDate) {
                    // שלב ב': בחירת שעה מיד אחרי אישור התאריך
                    DateTimePickerAndroid.open({
                        value: selectedDate,
                        mode: 'time',
                        is24Hour: true,
                        display: 'clock',
                        onChange: (timeEvent, finalDate) => {
                            if (timeEvent.type === 'set' && finalDate) {
                                setDueDate(finalDate);
                            }
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
            const res = await fetch(`${API_BASE}/api/tasks/`, {
                headers: { 'Authorization': `Token ${token}` }
            });
            const data = await res.json();
            setTasks(Array.isArray(data) ? data : []);
        } catch (err) {
            console.log('Fetch error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token]);

    useEffect(() => {
        (async () => {
            const savedToken = await AsyncStorage.getItem('userToken');
            if (savedToken) setToken(savedToken);
            setLoading(false);
        })();
    }, []);

    useEffect(() => { if (token) fetchTasks(); }, [token, fetchTasks]);

    const createTask = async () => {
        const title = newTitle.trim();
        if (!title || !token) return;

        setCreating(true);
        try {
            // תזמון התראה מקומית
            const notifId = await scheduleNotification(title, dueDate);

            const res = await fetch(`${API_BASE}/api/tasks/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                body: JSON.stringify({
                    title,
                    dueDate: dueDate.toISOString(),
                    notificationId: notifId // שים לב: השרת צריך לתמוך בשדה זה
                }),
            });

            const created = await res.json();
            setTasks(prev => [created, ...prev]);
            setNewTitle('');
            setDueDate(new Date());
        } catch (err) {
            Alert.alert("שגיאה", "שגיאה בשמירת המשימה");
        } finally { setCreating(false); }
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

    // --- 4. מסכי התחברות ---

    if (!token) {
        return (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
                <Text style={styles.brand}>TaskAware</Text>
                <TextInput style={styles.input} placeholder="שם משתמש" value={username} onChangeText={setUsername} autoCapitalize="none" />
                <TextInput style={styles.input} placeholder="סיסמה" secureTextEntry value={password} onChangeText={setPassword} />
                <TouchableOpacity style={styles.addBtn} onPress={async () => {
                    const path = isLoginMode ? '/api/login' : '/api/signup';
                    try {
                        const res = await fetch(`${API_BASE}${path}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username, password }),
                        });
                        const data = await res.json();
                        if (data.token) {
                            await AsyncStorage.setItem('userToken', data.token);
                            setToken(data.token);
                        } else { Alert.alert("שגיאה", "פרטי התחברות שגויים"); }
                    } catch (e) { Alert.alert("שגיאה", "חיבור לשרת נכשל"); }
                }}>
                    <Text style={styles.addBtnText}>{isLoginMode ? 'כניסה' : 'הרשמה'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsLoginMode(!isLoginMode)}>
                    <Text style={{ textAlign: 'center', marginTop: 15 }}>{isLoginMode ? 'עבור להרשמה' : 'עבור להתחברות'}</Text>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.brand}>TaskAware</Text>
                <TouchableOpacity onPress={() => { AsyncStorage.removeItem('userToken'); setToken(null); }}>
                    <Text style={{ color: '#ef4444' }}>יציאה</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.inputRow}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="משימה חדשה..." value={newTitle} onChangeText={setNewTitle} />

                <TouchableOpacity
                    style={styles.datePickerBtn}
                    onPress={() => Platform.OS === 'android' ? showAndroidPicker() : setShowIOSPicker(true)}
                >
                    <Text style={{ fontSize: 20 }}>📅</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.addBtn} onPress={createTask} disabled={creating}>
                    {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.addBtnText}>+</Text>}
                </TouchableOpacity>
            </View>

            <Text style={styles.dateInfo}>מיועד ל: {formatDisplayDate(dueDate)}</Text>

            {/* iOS Picker Modal */}
            {Platform.OS === 'ios' && showIOSPicker && (
                <Modal transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                        <View style={styles.pickerContainer}>
                            <TouchableOpacity style={{ alignSelf: 'flex-end', padding: 10 }} onPress={() => setShowIOSPicker(false)}>
                                <Text style={{ color: 'blue', fontWeight: 'bold' }}>סיום</Text>
                            </TouchableOpacity>
                            <DateTimePicker
                                value={dueDate}
                                mode="datetime"
                                display="spinner"
                                onChange={(e, d) => d && setDueDate(d)}
                            />
                        </View>
                    </View>
                </Modal>
            )}

            <FlatList
                data={tasks}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.taskRow} onPress={() => setSelectedTask(item)}>
                        <Text style={[styles.taskTitle, item.isCompleted && { textDecorationLine: 'line-through' }]}>{item.title}</Text>
                        <Text style={styles.taskDate}>⏰ {formatDisplayDate(item.dueDate)}</Text>
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
                    // ביטול התראה אם המשימה בוצעה
                    if (newStatus) await cancelNotification(task.notificationId);

                    await handleUpdateTask(task._id, { isCompleted: newStatus });
                    setSelectedTask(null);
                }}
                onDelete={async (id) => {
                    // ביטול התראה במחיקה
                    if (selectedTask?.notificationId) {
                        await cancelNotification(selectedTask.notificationId);
                    }
                    await fetch(`${API_BASE}/api/tasks/${id}/`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Token ${token}` }
                    });
                    setTasks(prev => prev.filter(t => t._id !== id));
                    setSelectedTask(null);
                }}
                onEdit={(task) => {
                    setEditingTask(task);
                    setSelectedTask(null);
                }}
            />

            <EditTask
                visible={!!editingTask}
                task={editingTask}
                onClose={() => setEditingTask(null)}
                onSave={async (id, title) => {
                    await handleUpdateTask(id, { title });
                    setEditingTask(null);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: 60, paddingHorizontal: 18, backgroundColor: '#f7f9fb' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    brand: { fontSize: 28, fontWeight: '800' },
    inputRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    input: { height: 50, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 15, borderWidth: 1, borderColor: '#ddd' },
    addBtn: { width: 50, height: 50, backgroundColor: '#2f855a', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    addBtnText: { color: '#fff', fontSize: 24 },
    datePickerBtn: { width: 50, height: 50, backgroundColor: '#fff', borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
    dateInfo: { fontSize: 13, color: '#2f855a', marginBottom: 10, fontWeight: '600' },
    taskRow: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
    taskTitle: { fontSize: 16, fontWeight: '500' },
    taskDate: { fontSize: 12, color: '#666', marginTop: 4 },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    pickerContainer: { backgroundColor: 'white', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 }
});