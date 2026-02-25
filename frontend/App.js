import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import * as Notifications from 'expo-notifications'; // ייבוא התראות
import { useLocationSync } from './src/useLocationSync.js';

// --- ייבוא המודלים ---
import TaskDetailModal from './src/components/TaskDetailModal';
import EditTask from './src/EditTask';
import DateTimePicker from '@react-native-community/datetimepicker';

const API_BASE = 'https://taskaware-backend.onrender.com';

// הגדרת האופן שבו התראות יופיעו כשהאפליקציה פתוחה
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export default function App() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    
    // תאריכים והתראות
    const [dueDate, setDueDate] = useState(new Date());
    const [tempDate, setTempDate] = useState(new Date());
    const [showPicker, setShowPicker] = useState(false);

    const [selectedTask, setSelectedTask] = useState(null);
    const [editingTask, setEditingTask] = useState(null);

    const [token, setToken] = useState(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoginMode, setIsLoginMode] = useState(true);

    const { location } = useLocationSync(API_BASE, token);

    // --- ניהול התראות ---

    useEffect(() => {
        const requestPermissions = async () => {
            const { status } = await Notifications.getPermissionsAsync();
            if (status !== 'granted') {
                await Notifications.requestPermissionsAsync();
            }
        };
        requestPermissions();
    }, []);

    const scheduleNotification = async (task) => {
        if (!task.dueDate) return;
        const trigger = new Date(task.dueDate);
        if (trigger <= new Date()) return;

        const identifier = await Notifications.scheduleNotificationAsync({
            content: {
                title: "תזכורת למשימה ⏰",
                body: task.title,
                sound: true,
            },
            trigger,
        });
        await AsyncStorage.setItem(`notif_${task._id}`, identifier);
    };

    const cancelNotification = async (taskId) => {
        const identifier = await AsyncStorage.getItem(`notif_${taskId}`);
        if (identifier) {
            await Notifications.cancelScheduledNotificationAsync(identifier);
            await AsyncStorage.removeItem(`notif_${taskId}`);
        }
    };

    // --- לוגיקת בחירת תאריך ---

    const onDateChange = (event, selectedDate) => {
        if (Platform.OS === 'android') {
            setShowPicker(false);
            if (selectedDate) setDueDate(selectedDate);
        } else {
            if (selectedDate) setTempDate(selectedDate);
        }
    };

    const confirmDate = () => {
        setDueDate(tempDate);
        setShowPicker(false);
    };

    // --- פונקציות API ---

    useEffect(() => {
        const loadToken = async () => {
            const savedToken = await AsyncStorage.getItem('userToken');
            if (savedToken) setToken(savedToken);
            setLoading(false);
        };
        loadToken();
    }, []);

    const fetchTasks = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE}/api/tasks/`, {
                headers: { 'Authorization': `Token ${token}` }
            });
            const data = await res.json();
            setTasks(Array.isArray(data) ? data : []);
        } catch (err) {
            setError('לא הצלחנו לטעון משימות.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token]);

    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    const createTask = useCallback(async () => {
        const title = newTitle.trim();
        if (!title || !token) return;
        setCreating(true);
        try {
            const res = await fetch(`${API_BASE}/api/tasks/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                body: JSON.stringify({ title, dueDate: dueDate.toISOString() }),
            });
            const created = await res.json();
            await scheduleNotification(created); // תזמון התראה
            setTasks((prev) => [created, ...prev]);
            setNewTitle('');
            setDueDate(new Date());
        } catch (err) {
            setError('שגיאה ביצירה');
        } finally {
            setCreating(false);
        }
    }, [newTitle, token, dueDate]);

    const toggleTask = useCallback(async (task) => {
        const next = !task.isCompleted;
        try {
            const res = await fetch(`${API_BASE}/api/tasks/${task._id}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                body: JSON.stringify({ isCompleted: next }),
            });
            const updated = await res.json();
            
            if (updated.isCompleted) {
                await cancelNotification(task._id);
            } else {
                await scheduleNotification(updated);
            }

            setTasks((prev) => prev.map((t) => (t._id === task._id ? updated : t)));
        } catch (err) { setError('עדכון נכשל'); }
    }, [token]);

    const deleteTask = useCallback(async (taskId) => {
        try {
            const res = await fetch(`${API_BASE}/api/tasks/${taskId}/`, {
                method: 'DELETE',
                headers: { 'Authorization': `Token ${token}` }
            });
            if (res.ok) {
                await cancelNotification(taskId); // ביטול התראה
                setTasks(prev => prev.filter(t => t._id !== taskId));
                setSelectedTask(null);
            }
        } catch (err) { console.error(err); }
    }, [token]);

    // ... handleAuth ופונקציות עזר נוספות ...
    const handleAuth = async () => {
        setLoading(true);
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
            } else { throw new Error('שגיאה בהתחברות'); }
        } catch (err) { setError(err.message); } finally { setLoading(false); }
    };

    const updateTaskTitle = async (taskId, title) => {
        const res = await fetch(`${API_BASE}/api/tasks/${taskId}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
            body: JSON.stringify({ title }),
        });
        const updated = await res.json();
        setTasks(prev => prev.map(t => t._id === taskId ? updated : t));
    };

    if (!token) {
        return (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
                <Text style={styles.brand}>TaskAware</Text>
                <TextInput style={styles.input} placeholder="שם משתמש" value={username} onChangeText={setUsername} autoCapitalize="none" />
                <TextInput style={styles.input} placeholder="סיסמה" secureTextEntry value={password} onChangeText={setPassword} />
                <TouchableOpacity style={styles.addBtn} onPress={handleAuth}>
                    <Text style={styles.addBtnText}>{isLoginMode ? 'כניסה' : 'הרשמה'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsLoginMode(!isLoginMode)}>
                    <Text style={{textAlign: 'center', marginTop: 15}}>{isLoginMode ? 'אין חשבון? הירשם' : 'יש חשבון? התחבר'}</Text>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.brand}>TaskAware</Text>
                    <Text style={styles.subBrand}>המשימות שלך</Text>
                </View>
                <TouchableOpacity onPress={() => { AsyncStorage.removeItem('userToken'); setToken(null); }}>
                    <Text style={{ color: '#ef4444' }}>יציאה</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.inputRow}>
                <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="מה עושים היום?"
                    value={newTitle}
                    onChangeText={setNewTitle}
                />
                <TouchableOpacity style={styles.datePickerBtn} onPress={() => { setTempDate(dueDate); setShowPicker(true); }}>
                    <Text style={{ fontSize: 20 }}>📅</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addBtn} onPress={createTask} disabled={!newTitle.trim()}>
                    <Text style={styles.addBtnText}>+</Text>
                </TouchableOpacity>
            </View>

            {/* Modal לתאריך ב-iOS */}
            {showPicker && Platform.OS === 'ios' && (
                <Modal transparent={true} animationType="slide">
                    <View style={styles.modalOverlay}>
                        <View style={styles.pickerContainer}>
                            <View style={styles.pickerHeader}>
                                <TouchableOpacity onPress={() => setShowPicker(false)}><Text style={{color: 'red'}}>ביטול</Text></TouchableOpacity>
                                <TouchableOpacity onPress={confirmDate}><Text style={{color: 'green', fontWeight: 'bold'}}>אישור</Text></TouchableOpacity>
                            </View>
                            <DateTimePicker value={tempDate} mode="datetime" is24Hour={true} display="spinner" onChange={onDateChange} />
                        </View>
                    </View>
                </Modal>
            )}

            {/* Picker לאנדרואיד */}
            {showPicker && Platform.OS === 'android' && (
                <DateTimePicker value={dueDate} mode="datetime" is24Hour={true} onChange={onDateChange} />
            )}

            <Text style={styles.dateInfo}>זמן נבחר: {dueDate.toLocaleString('he-IL')}</Text>

            <FlatList
                data={tasks}
                keyExtractor={(item) => item._id.toString()}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.taskRow} onPress={() => setSelectedTask(item)}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.taskTitle, item.isCompleted && styles.completedText]}>
                                {item.isCompleted ? '✓ ' : '○ '}{item.title}
                            </Text>
                            {item.dueDate && (
                                <Text style={styles.taskDate}>⏰ {new Date(item.dueDate).toLocaleString('he-IL')}</Text>
                            )}
                        </View>
                    </TouchableOpacity>
                )}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchTasks} />}
            />

            <TaskDetailModal visible={!!selectedTask} task={selectedTask} onClose={() => setSelectedTask(null)} onToggle={toggleTask} onDelete={deleteTask} onEdit={(t) => { setSelectedTask(null); setEditingTask(t); }} />
            <EditTask visible={!!editingTask} task={editingTask} onClose={() => setEditingTask(null)} onSave={updateTaskTitle} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: 60, paddingHorizontal: 18, backgroundColor: '#f7f9fb' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    brand: { fontSize: 28, fontWeight: '800' },
    subBrand: { fontSize: 14, color: '#6b7280' },
    inputRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    input: { height: 50, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 15, borderWidth: 1, borderColor: '#ddd' },
    addBtn: { width: 50, height: 50, backgroundColor: '#2f855a', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    addBtnText: { color: '#fff', fontSize: 24 },
    datePickerBtn: { width: 50, height: 50, backgroundColor: '#fff', borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
    dateInfo: { fontSize: 12, color: '#2f855a', marginBottom: 10 },
    taskRow: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
    taskTitle: { fontSize: 16 },
    completedText: { textDecorationLine: 'line-through', color: '#aaa' },
    taskDate: { fontSize: 12, color: '#666', marginTop: 5 },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    pickerContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 },
    pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' }
});