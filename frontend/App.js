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
    Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocationSync } from './src/useLocationSync.js';

// --- ייבוא המודלים ---
import TaskDetailModal from './src/components/TaskDetailModal';
import EditTask from './src/EditTask';
import DateTimePicker from '@react-native-community/datetimepicker';

const API_BASE = 'https://taskaware-backend.onrender.com';



export default function App() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const [dueDate, setDueDate] = useState(new Date());
    const [showPicker, setShowPicker] = useState(false);


    const [selectedTask, setSelectedTask] = useState(null);
    const [editingTask, setEditingTask] = useState(null);

    const [token, setToken] = useState(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoginMode, setIsLoginMode] = useState(true);

    const { location } = useLocationSync(API_BASE, token);

    const onDateChange = (event, selectedDate) => {
        setShowPicker(false);
    if (selectedDate) {
        setDueDate(selectedDate);
        }
    };

    useEffect(() => {
        const loadToken = async () => {
            const savedToken = await AsyncStorage.getItem('userToken');
            if (savedToken) setToken(savedToken);
            setLoading(false);
        };
        loadToken();
    }, []);

    const handleAuth = async () => {
        if (!username || !password) {
            setError('נא להזין שם משתמש וסיסמה');
            return;
        }
        setLoading(true);
        setError('');

        // גם כאן הוספתי לוכסן ליתר ביטחון
        const path = isLoginMode ? '/api/login' : '/api/signup';
        console.log(`Trying to fetch: ${API_BASE}${path}`);

        try {
            const res = await fetch(`${API_BASE}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();
            console.log("Auth Response:", data);

            if (!res.ok) {
                const msg = data.msg || (data.username ? data.username[0] : 'שגיאה בתהליך');
                throw new Error(msg);
            }

            if (data.token) {
                await AsyncStorage.setItem('userToken', data.token);
                setToken(data.token);
            } else {
                throw new Error('לא התקבל אישור כניסה מהשרת');
            }

        } catch (err) {
            console.log(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchTasks = useCallback(async () => {
        if (!token) return;
        setError('');
        try {
            // תיקון קריטי: הוספת / בסוף הכתובת
            console.log("Fetching tasks with token:", token);
            const res = await fetch(`${API_BASE}/api/tasks/`, {
                headers: {
                    'Authorization': `Token ${token}`
                }
            });

            if (res.status === 401) {
                console.log("Got 401 in fetchTasks - Token might be invalid or Header dropped");
                // טיפ לדיבוג: אם זה עדיין קורה, תבדוק מה השרת מדפיס
                setToken(null);
                return;
            }

            const data = await res.json();
            setTasks(Array.isArray(data) ? data : []);
        } catch (err) {
            console.log("Fetch Error:", err);
            setError('לא הצלחנו לטעון משימות. בדוק חיבור.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchTasks();
    }, [fetchTasks]);

    const createTask = useCallback(async () => {
        const title = newTitle.trim();
        if (!title || !token) return;

        setCreating(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/api/tasks/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                },
                body: JSON.stringify({
                    title: newTitle,
                    dueDate: dueDate.toISOString()
                }),
            });
            if (!res.ok) {
                const errText = await res.text();
                console.log("Create Error Body:", errText);
                throw new Error('שגיאה ביצירה');
            }
            const created = await res.json();
            setTasks((prev) => [created, ...prev]);
            setNewTitle('');
        } catch (err) {
            console.log("Create Error:", err);
            setError('לא ניתן ליצור משימה.');
        } finally {
            setCreating(false);
        }
    }, [newTitle, token, dueDate]);

    const toggleTask = useCallback(async (task) => {
        const next = !task.isCompleted;
        try {
            // שינוי 1: הכתובת היא ישירות למשימה (בלי /status)
            // שינוי 2: שיטת PATCH
            const res = await fetch(`${API_BASE}/api/tasks/${task._id}/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                },
                body: JSON.stringify({ isCompleted: next }),
            });

            if (!res.ok) throw new Error('Failed to update');

            const updated = await res.json();

            setTasks((prev) => prev.map((t) => (t._id === task._id ? updated : t)));

            if (selectedTask && selectedTask._id === task._id) {
                setSelectedTask(updated);
            }
        } catch (err) {
            console.log(err);
            setError('עדכון נכשל.');
        }
    }, [token, selectedTask]);

    const deleteTask = useCallback(async (taskId) => {
        try {
            // תיקון כפול: הוספת / וגם עטיפת ה-Authorization ב-headers
            const res = await fetch(`${API_BASE}/api/tasks/${taskId}/`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Token ${token}`
                }
            });
            if (res.ok) {
                setTasks(prev => prev.filter(t => t._id !== taskId));
                setSelectedTask(null);
            }
        } catch (err) {
            console.error("Delete Error", err);
        }
    }, [token]);

    const updateTaskTitle = useCallback(async (taskId, newTitle) => {
        try {
            // שינוי 1: הכתובת היא ישירות למשימה (בלי /title) וחובה לוכסן בסוף
            // שינוי 2: השיטה היא PATCH (עדכון חלקי)
            const res = await fetch(`${API_BASE}/api/tasks/${taskId}/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                },
                body: JSON.stringify({ title: newTitle }),
            });

            if (!res.ok) {
                const errText = await res.text();
                console.log("Update failed:", errText);
                throw new Error('עדכון נכשל');
            }

            const updated = await res.json();

            setTasks((prev) => prev.map((t) => (t._id === taskId ? updated : t)));

            if (selectedTask && selectedTask._id === taskId) {
                setSelectedTask(updated);
            }
        } catch (err) {
            console.error("Update Error", err);
            throw err;
        }
    }, [token, selectedTask]);

    const startEditing = useCallback((task) => {
        setSelectedTask(null);
        setTimeout(() => {
            setEditingTask(task);
        }, 500);
    }, []);

    const listEmpty = useMemo(() => tasks.length === 0, [tasks]);

    if (!token) {
        return (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
                <Text style={styles.brand}>TaskAware</Text>
                <Text style={styles.subBrand}>{isLoginMode ? 'התחברות' : 'הרשמה'}</Text>

                <View style={{ gap: 10, marginTop: 20 }}>
                    <TextInput
                        style={styles.input}
                        placeholder="שם משתמש"
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="סיסמה"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />
                    <TouchableOpacity style={styles.addBtn} onPress={handleAuth} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.addBtnText}>{isLoginMode ? 'כניסה' : 'הרשמה'}</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setIsLoginMode(!isLoginMode)}>
                        <Text style={[styles.subBrand, { textAlign: 'center', marginTop: 15 }]}>
                            {isLoginMode ? 'אין חשבון? הירשם כאן' : 'יש חשבון? התחבר'}
                        </Text>
                    </TouchableOpacity>
                </View>
                {error ? <Text style={styles.error}>{error}</Text> : null}
            </KeyboardAvoidingView>
        );
    }

    return (
        <View style={styles.container}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                    <Text style={styles.brand}>TaskAware</Text>
                    <Text style={styles.subBrand}>המשימות שלך</Text>
                    {location && (
                        <Text style={{ fontSize: 10, color: '#10b981' }}>מיקום מסונכרן ✓</Text>
                    )}
                </View>
                <TouchableOpacity onPress={async () => { await AsyncStorage.removeItem('userToken'); setToken(null); }}>
                    <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>יציאה</Text>
                </TouchableOpacity>
            </View>

<View style={styles.inputRow}>
    <TextInput
        style={[styles.input, { flex: 1 }]} // הוספנו flex: 1 כדי שישאיר מקום לכפתורים
        placeholder="מה יש לעשות היום?"
        placeholderTextColor="#9aa0a6"
        value={newTitle}
        onChangeText={setNewTitle}
        editable={!creating}
        onSubmitEditing={createTask}
    />

    {/* כפתור בחירת זמן */}
    <TouchableOpacity 
        style={styles.datePickerBtn} 
        onPress={() => setShowPicker(true)}
    >
        <Text style={{ fontSize: 20 }}>📅</Text>
    </TouchableOpacity>

    {showPicker && (
        <DateTimePicker
            value={dueDate}
            mode="datetime" // מאפשר לבחור גם תאריך וגם שעה
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
        />
    )}

    <TouchableOpacity
        style={[styles.addBtn, (creating || !newTitle.trim()) && styles.addBtnDisabled]}
        onPress={createTask}
        disabled={creating || !newTitle.trim()}
    >
        {creating ? (
            <ActivityIndicator color="#fff" size="small" />
        ) : (
            <Text style={styles.addBtnText}>+</Text>
        )}
    </TouchableOpacity>
</View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <FlatList
                data={tasks}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.taskRow}
                        onPress={() => setSelectedTask(item)}
                        activeOpacity={0.7}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                            <Text style={styles.statusIcon}>{item.isCompleted ? '✓' : '○'}</Text>
                            <Text
                                style={[styles.taskTitle, item.isCompleted ? styles.completedText : null]}
                                numberOfLines={1}
                            >
                                {item.title}
                            </Text>
                        </View>
                        <Text style={{ color: '#d1d5db' }}>‹</Text>
                    </TouchableOpacity>
                )}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={listEmpty && styles.emptyContainer}
                ListEmptyComponent={<Text style={styles.emptyText}>הכל ריק... זמן לנוח? 🏝️</Text>}
            />

            <TaskDetailModal
                visible={!!selectedTask}
                task={selectedTask}
                onClose={() => setSelectedTask(null)}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onEdit={startEditing}
            />

            <EditTask
                visible={!!editingTask}
                task={editingTask}
                onClose={() => setEditingTask(null)}
                onSave={updateTaskTitle}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: 60, paddingHorizontal: 18, backgroundColor: '#f7f9fb', gap: 12 },
    brand: { fontSize: 28, fontWeight: '800', color: '#1f2937' },
    subBrand: { fontSize: 14, color: '#6b7280' },
    inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 10 },
    input: { height: 55, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#000307', paddingHorizontal: 15, fontSize: 18, color: '#111827' }, addBtn: { minWidth: 48, height: 48, borderRadius: 10, backgroundColor: '#2f855a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
    addBtnDisabled: { opacity: 0.5 },
    addBtnText: { color: '#fff', fontSize: 24, fontWeight: '700' },
    error: { color: '#b91c1c', fontSize: 14, textAlign: 'center' },
    taskRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginVertical: 6 },
    taskTitle: { fontSize: 16, color: '#111827' },
    completedText: { textDecorationLine: 'line-through', color: '#9ca3af' },
    statusIcon: { fontSize: 18, color: '#2f855a', fontWeight: '700' },
    emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: '#9ca3af', fontSize: 15 },
});