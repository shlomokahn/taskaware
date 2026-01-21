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

const API_BASE = 'https://taskaware-backend.onrender.com';

export default function App() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    // State לניהול המשימה שנבחרה להצגה במודל
    const [selectedTask, setSelectedTask] = useState(null);
    const [editingTask, setEditingTask] = useState(null);

    const [token, setToken] = useState(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoginMode, setIsLoginMode] = useState(true);

    const { location } = useLocationSync(API_BASE, token);

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
        const path = isLoginMode ? '/api/login' : '/api/signup';

        try {
            const res = await fetch(`${API_BASE}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.msg || 'שגיאה בתהליך');

            if (isLoginMode) {
                await AsyncStorage.setItem('userToken', data.token);
                setToken(data.token);
            } else {
                alert('נרשמת בהצלחה! כעת התחבר');
                setIsLoginMode(true);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchTasks = useCallback(async () => {
        if (!token) return;
        setError('');
        try {
            const res = await fetch(`${API_BASE}/api/tasks`, {
                headers: { 'x-access-token': token }
            });
            if (res.status === 401) {
                setToken(null);
                return;
            }
            const data = await res.json();
            setTasks(Array.isArray(data) ? data : []);
        } catch (err) {
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
            // שים לב: כאן ה-Backend מצפה ללא לוכסן בסוף, כפי שתיקנו
            const res = await fetch(`${API_BASE}/api/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                body: JSON.stringify({ title }),
            });
            if (!res.ok) throw new Error('שגיאה ביצירה');
            const created = await res.json();
            setTasks((prev) => [created, ...prev]);
            setNewTitle('');
        } catch (err) {
            console.log("Create Error:", err);
            setError('לא ניתן ליצור משימה.');
        } finally {
            setCreating(false);
        }
    }, [newTitle, token]);

    // עדכון סטטוס משימה
    const toggleTask = useCallback(async (task) => {
        const next = !task.isCompleted;
        try {
            const res = await fetch(`${API_BASE}/api/tasks/${task._id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                body: JSON.stringify({ isCompleted: next }),
            });
            const updated = await res.json();

            // עדכון הרשימה הראשית
            setTasks((prev) => prev.map((t) => (t._id === task._id ? updated : t)));

            // אם המודל פתוח על המשימה הזו, נעדכן גם אותו כדי שיראה את השינוי מיד
            if (selectedTask && selectedTask._id === task._id) {
                setSelectedTask(updated);
            }
        } catch (err) {
            setError('עדכון נכשל.');
        }
    }, [token, selectedTask]);

    // מחיקת משימה
    const deleteTask = useCallback(async (taskId) => {
        try {
            const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
                method: 'DELETE',
                headers: { 'x-access-token': token }
            });
            if (res.ok) {
                setTasks(prev => prev.filter(t => t._id !== taskId));
                // סגירת המודל אם היה פתוח
                setSelectedTask(null);
            }
        } catch (err) {
            console.error("Delete Error", err);
        }
    }, [token]);

    // עדכון כותרת משימה
    const updateTaskTitle = useCallback(async (taskId, newTitle) => {
        try {
            const res = await fetch(`${API_BASE}/api/tasks/${taskId}/title`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                body: JSON.stringify({ title: newTitle }),
            });
            if (!res.ok) throw new Error('עדכון נכשל');
            const updated = await res.json();

            // עדכון הרשימה הראשית
            setTasks((prev) => prev.map((t) => (t._id === taskId ? updated : t)));

            // עדכון המודל הפתוח אם הוא של המשימה הזו
            if (selectedTask && selectedTask._id === taskId) {
                setSelectedTask(updated);
            }
        } catch (err) {
            console.error("Update Error", err);
            throw err;
        }
    }, [token, selectedTask]);

    const listEmpty = useMemo(() => tasks.length === 0, [tasks]);

    // --- לוגין UI ---
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

    // --- ראשי UI ---
    return (
        <View style={styles.container}>
            {/* כותרת עליונה */}
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

            {/* שורת הוספה */}
            <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    placeholder="מה יש לעשות היום?"
                    placeholderTextColor="#9aa0a6"
                    value={newTitle}
                    onChangeText={setNewTitle}
                    editable={!creating}
                    onSubmitEditing={createTask}
                />
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

            {/* רשימת המשימות */}
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

            {/* --- מודל פרטי משימה --- */}
            <TaskDetailModal
                visible={!!selectedTask}
                task={selectedTask}
                onClose={() => setSelectedTask(null)}
                onToggle={toggleTask}
                onDelete={deleteTask}
                onEdit={setEditingTask}
            />

            {/* --- מודל עריכת משימה --- */}
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
    inputRow: {flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 10 },
    input: {height: 55, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#000307', paddingHorizontal: 15, fontSize: 18,  color: '#111827'},    addBtn: { minWidth: 48, height: 48, borderRadius: 10, backgroundColor: '#2f855a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
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

