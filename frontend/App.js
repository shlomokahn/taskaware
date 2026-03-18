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
    Alert,
    SafeAreaView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useLocationSync } from './src/useLocationSync.js';

import TaskDetailModal from './src/components/TaskDetailModal';
import EditTask from './src/EditTask';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

import * as Device from 'expo-device';
import Constants from 'expo-constants';

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

    // ניהול טאבים
    const [activeTab, setActiveTab] = useState('home');

    const [newTitle, setNewTitle] = useState('');
    const [dueDate, setDueDate] = useState(new Date());
    const [creating, setCreating] = useState(false);
    const [isSmartTask, setIsSmartTask] = useState(false);

    const [showIOSPicker, setShowIOSPicker] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [editingTask, setEditingTask] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);

    const [token, setToken] = useState(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoginMode, setIsLoginMode] = useState(true);
    const [isAuthLoading, setIsAuthLoading] = useState(false);

    const { location, syncLocation, isSyncing } = useLocationSync(API_BASE, token);

    // --- התראות (ללא שינוי) ---
    useEffect(() => {
        Notifications.cancelAllScheduledNotificationsAsync();
        async function setupPushNotifications() {
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'Task Reminders',
                    importance: (Notifications.AndroidImportance && Notifications.AndroidImportance.HIGH) || 4,
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
        const triggerDate = new Date(date);
        if (triggerDate <= new Date()) return null;
        try {
                return await Notifications.scheduleNotificationAsync({
                content: {
                    title: "תזכורת למשימה! 🔔",
                    body: taskTitle,
                    sound: true,
                    priority: (Notifications.AndroidPriority && Notifications.AndroidPriority.HIGH) || 1,
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: triggerDate,
                    channelId: 'default',
                },
            });
        } catch (e) {
            console.error("שגיאה בתזמון ההתראה:", e);
            return null;
        }
    };

    const cancelNotification = async (notifId) => {
        if (notifId) await Notifications.cancelScheduledNotificationAsync(notifId);
    };

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

    const openAndroidDate = () => {
        DateTimePickerAndroid.open({
            value: dueDate, mode: 'date', display: 'calendar',
            onChange: (event, selectedDate) => {
                if (event.type === 'set' && selectedDate) {
                    const d = new Date(dueDate);
                    d.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                    setDueDate(d);
                }
            },
        });
    };

    const openAndroidTime = () => {
        DateTimePickerAndroid.open({
            value: dueDate, mode: 'time', is24Hour: true, display: 'clock',
            onChange: (event, selectedTime) => {
                if (event.type === 'set' && selectedTime) {
                    const d = new Date(dueDate);
                    d.setHours(selectedTime.getHours(), selectedTime.getMinutes());
                    setDueDate(d);
                }
            },
        });
    };

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
            const savedUser = await AsyncStorage.getItem('username');
            if (savedToken) setToken(savedToken);
            if (savedUser) setUsername(savedUser);
            setLoading(false);
        })();
    }, []);

    useEffect(() => { if (token) fetchTasks(); }, [token, fetchTasks]);

    const fetchLocationFromAI = async (taskTitle) => {
        try {
            const res = await fetch(`${API_BASE}/api/ask-ai/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                body: JSON.stringify({ title: taskTitle }),
            });
            if (!res.ok) return null;
            const data = await res.json();
            return data.locationQuery || null;
        } catch (error) {
            console.error("שגיאה בקבלת מיקום מה-AI:", error);
            return null;
        }
    };

    const createTask = async () => {
        const title = newTitle.trim();
        if (!title || !token) return;
        if (dueDate <= new Date()) {
            Alert.alert("תאריך לא תקין", "אנא בחר תאריך ושעה בעתיד");
            return;
        }
        setCreating(true);
        try {
            let suggestedLocation = '';
            if (isSmartTask) {
                suggestedLocation = await fetchLocationFromAI(title);
            }
            const notifId = await scheduleNotification(title, dueDate);
            const res = await fetch(`${API_BASE}/api/tasks/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                body: JSON.stringify({
                    title,
                    dueDate: dueDate.toISOString(),
                    notificationId: notifId,
                    locationQuery: suggestedLocation
                }),
            });
            if (!res.ok) throw new Error("נכשל בשמירת המשימה");
            const created = await res.json();
            setTasks(prev => [created, ...prev]);
            setNewTitle('');
            setDueDate(new Date());
            setIsSmartTask(false);
            setShowAddModal(false);
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
            setTasks(prev => prev.map(t => (t._id || t.id) === taskId ? updated : t));
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

    const handleLogout = async () => {
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('username');
        setToken(null);
        setActiveTab('home');
    };

    const handleLocationSync = async () => {
        const result = await syncLocation();
        if (result.success) {
            Alert.alert('הצלחה', 'המיקום סונכרן בהצלחה');
            return;
        }

        if (result.error === 'Permission denied') {
            Alert.alert('הרשאת מיקום נדרשת', 'כדי לסנכרן מיקום יש לאשר גישה למיקום במכשיר');
            return;
        }

        Alert.alert('שגיאה', 'סנכרון המיקום נכשל, נסה שוב');
    };

    // --- מסך התחברות ---
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
                            const path = isLoginMode ? '/api/login/' : '/api/signup/';
                            try {
                                const res = await fetch(`${API_BASE}${path}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ username, password }),
                                });
                                const textResponse = await res.text();
                                if (!res.ok) { Alert.alert("שגיאה מהשרת", "הבקשה נכשלה"); return; }
                                const data = JSON.parse(textResponse);
                                if (data.token) {
                                    await AsyncStorage.setItem('userToken', data.token);
                                    await AsyncStorage.setItem('username', username);
                                    setToken(data.token);
                                } else {
                                    Alert.alert("שגיאה", "פרטי התחברות שגויים");
                                }
                            } catch (e) {
                                Alert.alert("שגיאת רשת", "חיבור לשרת נכשל");
                            } finally {
                                setIsAuthLoading(false);
                            }
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

    // --- תוכן מסך הבית ---
    const renderHomeScreen = () => (
        <View style={{ flex: 1 }}>
            <View style={styles.header}>
                <Text style={styles.brand}>TaskAware</Text>
            </View>

            <Text style={styles.listTitle}>המשימות שלי</Text>
            <FlatList
                data={tasks}
                contentContainerStyle={{ paddingBottom: 100 }}
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
                        <View style={styles.taskContent}>
                            <Text style={[styles.taskTitle, item.isCompleted && styles.taskTitleCompleted]}>{item.title}</Text>
                            <Text style={styles.taskDate}>⏰ {formatDisplayDate(item.dueDate)}</Text>
                            {item.locationQuery && (
                                <Text style={styles.taskLocation}>📍 מומלץ לבצע ב: {item.locationQuery}</Text>
                            )}
                        </View>
                        <View style={[styles.statusCircle, item.isCompleted && styles.statusCircleCompleted]}>
                            {item.isCompleted && <Text style={styles.checkMark}>✓</Text>}
                        </View>
                    </TouchableOpacity>
                )}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchTasks} />}
            />
        </View>
    );

    // --- תוכן מסך הגדרות (אזור אישי) ---
    const renderSettingsScreen = () => (
        <View style={styles.settingsContainer}>
            <Text style={styles.settingsTitle}>הגדרות ואזור אישי</Text>

            <View style={styles.profileCard}>
                <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{username.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.profileName}>שלום, {username}</Text>
                <Text style={styles.profileSub}>המשתמש שלך מחובר ומסונכרן</Text>
            </View>

            <View style={styles.settingsList}>
                <TouchableOpacity style={styles.settingsItem}>
                    <Text style={styles.settingsItemText}>🔔 ניהול התראות</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.settingsItem}>
                    <Text style={styles.settingsItemText}>🛡️ פרטיות ואבטחה</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.settingsItem}
                    onPress={handleLocationSync}
                    disabled={isSyncing}
                >
                    <Text style={styles.settingsItemText}>{isSyncing ? '⏳ מסנכרן מיקום...' : '📍 סנכרון מיקום'}</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.logoutFullBtn} onPress={handleLogout}>
                <Text style={styles.logoutFullText}>יציאה מהחשבון</Text>
            </TouchableOpacity>
        </View>
    );

    // --- מסך ראשי משולב ---
    return (
        <SafeAreaView style={styles.container}>
            {activeTab === 'home' ? renderHomeScreen() : renderSettingsScreen()}

            {/* Bottom Tab Bar */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={styles.tabItem}
                    onPress={() => setActiveTab('home')}
                >
                    <Text style={[styles.tabIcon, activeTab === 'home' && styles.tabIconActive]}>🏠</Text>
                    <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>ראשי</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.addFloatingBtn} onPress={() => setShowAddModal(true)}>
                    <Text style={styles.addFloatingText}>＋</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.tabItem}
                    onPress={() => setActiveTab('settings')}
                >
                    <Text style={[styles.tabIcon, activeTab === 'settings' && styles.tabIconActive]}>👤</Text>
                    <Text style={[styles.tabLabel, activeTab === 'settings' && styles.tabLabelActive]}>אזור אישי</Text>
                </TouchableOpacity>
            </View>

            {/* Modals (Keep them global) */}
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
                onSave={async (id, title, newDueDate) => {
                    if (newDueDate && editingTask?.notificationId) {
                        await cancelNotification(editingTask.notificationId);
                    }
                    const newNotifId = newDueDate ? await scheduleNotification(title, newDueDate) : editingTask?.notificationId;
                    await handleUpdateTask(id, {
                        title,
                        ...(newDueDate && { dueDate: newDueDate }),
                        ...(newNotifId && { notificationId: newNotifId }),
                    });
                    setEditingTask(null);
                }}
            />

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

            {/* Add Task Modal (opened from bottom bar) */}
            <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.addModalOverlay}>
                    <View style={styles.addModalContent}>
                        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 18, fontWeight: '800' }}>הוספת משימה</Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                <Text style={{ color: 'blue', fontWeight: '700' }}>ביטול</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={{ height: 12 }} />

                        <TextInput
                            style={[styles.taskInput, styles.taskInputModal]}
                            placeholder="מה המשימה הבאה שלך?"
                            value={newTitle}
                            onChangeText={setNewTitle}
                            placeholderTextColor="#9ca3af"
                            autoFocus={true}
                            editable={true}
                            returnKeyType="done"
                            multiline={false}
                        />

                        <View style={{ height: 8 }} />

                        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                            <TouchableOpacity
                                style={[styles.modalHalfBtn, isSmartTask && styles.smartBtnActive]}
                                onPress={() => setIsSmartTask(!isSmartTask)}
                            >
                                <Text style={[styles.modalHalfBtnText, isSmartTask && styles.smartBtnTextActive]}>✨ AI</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.modalHalfBtn, styles.modalHalfBtnPrimary]} onPress={createTask} disabled={creating}>
                                {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalHalfBtnTextPrimary}>הוסף משימה</Text>}
                            </TouchableOpacity>
                        </View>

                        <View style={styles.pickersArea}>
                            {Platform.OS === 'ios' ? (
                                <>
                                    <View style={styles.inlinePickerWrapper}>
                                        <DateTimePicker
                                            value={dueDate}
                                            mode="date"
                                            display="compact"
                                            onChange={(e, d) => d && setDueDate(new Date(d.getFullYear(), d.getMonth(), d.getDate(), dueDate.getHours(), dueDate.getMinutes()))}
                                            style={styles.datePickerInline}
                                        />
                                    </View>

                                    <View style={styles.inlinePickerWrapper}>
                                        <DateTimePicker
                                            value={dueDate}
                                            mode="time"
                                            display="spinner"
                                            is24Hour={true}
                                            onChange={(e, d) => d && setDueDate(new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate(), d.getHours(), d.getMinutes()))}
                                            style={styles.timePickerInline}
                                        />
                                    </View>
                                </>
                            ) : (
                                <View style={styles.androidPickerContainer}>
                                    <TouchableOpacity style={styles.calendarPreview} onPress={openAndroidDate}>
                                        <Text style={styles.pickerLabel}>🗓️ בחר תאריך</Text>
                                        <Text style={styles.pickerValue}>{formatDisplayDate(dueDate).split(' ')[0]}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.timePreview} onPress={openAndroidTime}>
                                        <Text style={styles.pickerLabel}>⏰ בחר שעה</Text>
                                        <Text style={styles.pickerValue}>{formatDisplayDate(dueDate).split(' ')[1] || formatDisplayDate(dueDate)}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <View style={{ height: 18 }} />

                            {/* old add button removed; add action now in AI row */}
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    // (סגנונות קודמים נשמרים...)
    loginContainer: { flex: 1, justifyContent: 'center', backgroundColor: '#f3f4f6', paddingHorizontal: 20 },
    loginCard: { backgroundColor: '#fff', padding: 25, borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 5 },
    loginBrand: { fontSize: 36, fontWeight: '900', textAlign: 'center', marginBottom: 30, color: '#2f855a' },
    loginInput: { height: 55, backgroundColor: '#f9fafb', borderRadius: 16, paddingHorizontal: 15, marginBottom: 15, borderWidth: 1, borderColor: '#e5e7eb', textAlign: 'right', fontSize: 16 },
    loginBtn: { height: 55, backgroundColor: '#2f855a', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: '#2f855a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 },
    loginBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    switchModeText: { textAlign: 'center', marginTop: 20, color: '#4b5563', fontSize: 15, fontWeight: '600' },

    container: { flex: 1, backgroundColor: '#f3f4f6' },
    header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, paddingHorizontal: 20, paddingTop: 10 },
    brand: { fontSize: 32, fontWeight: '900', color: '#111827' },

    inputContainer: { backgroundColor: '#fff', padding: 20, borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, marginBottom: 30, marginHorizontal: 20 },
    inputRow: { flexDirection: 'row-reverse', gap: 12, marginBottom: 15 },
    taskInput: { flex: 1, height: 55, backgroundColor: '#f9fafb', borderRadius: 16, paddingHorizontal: 15, borderWidth: 1, borderColor: '#e5e7eb', textAlign: 'right', fontSize: 16, color: '#1f2937' },
    datePickerBtn: { width: 55, height: 55, backgroundColor: '#f3f4f6', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    smartBtn: { width: 55, height: 55, backgroundColor: '#f3f4f6', borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
    smartBtnActive: { backgroundColor: '#fdf4ff', borderColor: '#d946ef' },
    smartBtnText: { fontSize: 14, fontWeight: 'bold', color: '#9ca3af' },
    smartBtnTextActive: { color: '#d946ef' },
    actionRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
    dateInfo: { fontSize: 14, color: '#4b5563', fontWeight: '600' },
    addBtn: { backgroundColor: '#2f855a', paddingHorizontal: 20, height: 45, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    addBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

    listTitle: { fontSize: 20, fontWeight: '800', color: '#374151', textAlign: 'right', marginBottom: 15, paddingHorizontal: 20 },
    taskRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 18, borderRadius: 20, marginBottom: 12, marginHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    taskRowCompleted: { backgroundColor: '#f9fafb', opacity: 0.7 },
    taskContent: { flex: 1, paddingRight: 15 },
    taskTitle: { fontSize: 17, fontWeight: '700', color: '#1f2937', textAlign: 'right' },
    taskTitleCompleted: { textDecorationLine: 'line-through', color: '#9ca3af' },
    taskDate: { fontSize: 13, color: '#6b7280', textAlign: 'right' },
    taskLocation: { fontSize: 13, color: '#8b5cf6', textAlign: 'right', fontWeight: '600' },
    statusCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
    statusCircleCompleted: { backgroundColor: '#2f855a', borderColor: '#2f855a' },
    checkMark: { color: '#fff', fontSize: 16 },

    emptyState: { alignItems: 'center', marginTop: 40 },
    emptyStateText: { fontSize: 16, color: '#9ca3af' },

    // סגנונות חדשים ל-Bottom Bar
    bottomBar: {
        flexDirection: 'row-reverse',
        height: 80,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        paddingBottom: 20,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        justifyContent: 'space-around',
        alignItems: 'center',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 10
    },
    tabItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
    tabIcon: { fontSize: 24, opacity: 0.4 },
    tabIconActive: { opacity: 1 },
    tabLabel: { fontSize: 12, fontWeight: 'bold', color: '#9ca3af', marginTop: 4 },
    tabLabelActive: { color: '#2f855a' },

    // סגנונות למסך הגדרות
    settingsContainer: { flex: 1, padding: 25 },
    settingsTitle: { fontSize: 28, fontWeight: '900', color: '#111827', textAlign: 'right', marginBottom: 30 },
    profileCard: { backgroundColor: '#fff', padding: 30, borderRadius: 24, alignItems: 'center', marginBottom: 30, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
    avatarText: { fontSize: 32, fontWeight: 'bold', color: '#2f855a' },
    profileName: { fontSize: 22, fontWeight: 'bold', color: '#1f2937' },
    profileSub: { fontSize: 14, color: '#6b7280', marginTop: 5 },
    settingsList: { gap: 15 },
    settingsItem: { backgroundColor: '#fff', padding: 20, borderRadius: 16, flexDirection: 'row-reverse', alignItems: 'center' },
    settingsItemText: { fontSize: 16, fontWeight: '600', color: '#374151' },
    logoutFullBtn: { marginTop: 'auto', marginBottom: 100, backgroundColor: '#fee2e2', padding: 18, borderRadius: 16, alignItems: 'center' },
    logoutFullText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },

    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    pickerContainer: { backgroundColor: 'white', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    addFloatingBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2f855a', justifyContent: 'center', alignItems: 'center', marginTop: -28, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 6 },
    addFloatingText: { color: '#fff', fontSize: 30, lineHeight: 30, fontWeight: '900' },
    addModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
    addModalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 12, width: '92%', height: '70%', justifyContent: 'flex-start', overflow: 'hidden' },
    inlinePickerWrapper: { overflow: 'hidden', borderRadius: 12, backgroundColor: '#fff', marginBottom: 8 },
    pickersArea: { flex: 1, marginTop: 12 },
    datePickerInline: { width: '100%', backgroundColor: '#fff' },
    timePickerInline: { width: '100%', backgroundColor: '#fff' },
    androidPickerContainer: { flex: 1, justifyContent: 'center', gap: 12 },
    calendarPreview: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    timePreview: { height: 80, backgroundColor: '#f3f4f6', borderRadius: 12, padding: 16, justifyContent: 'center', alignItems: 'center' },
    pickerLabel: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
    pickerValue: { fontSize: 18, fontWeight: '800', color: '#111827', marginTop: 6 },
    taskInputModal: { flex: 0, height: 40, maxHeight: 40, minHeight: 40, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16, textAlignVertical: 'center' },
    modalHalfBtn: { flex: 1, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6' },
    modalHalfBtnPrimary: { backgroundColor: '#2f855a' },
    modalHalfBtnText: { fontSize: 15, fontWeight: '700', color: '#374151' },
    modalHalfBtnTextPrimary: { fontSize: 15, fontWeight: '700', color: '#fff' },
});