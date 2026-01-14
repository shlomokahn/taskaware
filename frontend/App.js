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

// ייבוא ה-Hook של המיקום כפי שהיה במקור
import { useLocationSync } from './src/useLocationSync.js';

const API_BASE = 'https://taskaware-backend.onrender.com';

export default function App() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    // States לניהול המשתמש והתחברות
    const [token, setToken] = useState(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoginMode, setIsLoginMode] = useState(true);

    // הפעלת סנכרון המיקום (כפי שהיה במקור)
    // הערה: ה-Hook הזה ישתמש ב-API_BASE כדי לעדכן את המיקום בשרת
    const { location } = useLocationSync(API_BASE, token);
    // 1. בדיקת טוקן שמור בטעינה ראשונה
    useEffect(() => {
        const loadToken = async () => {
            const savedToken = await AsyncStorage.getItem('userToken');
            if (savedToken) setToken(savedToken);
            setLoading(false);
        };
        loadToken();
    }, []);

    // 2. פונקציית התחברות / הרשמה
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

    // 3. שליפת משימות מהשרת (עם Token)
    const fetchTasks = useCallback(async () => {
        if (!token) return;
        setError('');
        try {
            const res = await fetch(`${API_BASE}/api/tasks`, {
                headers: { 'x-access-token': token }
            });
            if (res.status === 401) {
                setToken(null); // טוקן לא תקף - חזרה ללוגין
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

    // 4. יצירת משימה חדשה (עם Token)
    const createTask = useCallback(async () => {
        const title = newTitle.trim();
        if (!title || !token) return;

        setCreating(true);
        setError('');
        try {
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
            setError('לא ניתן ליצור משימה.');
        } finally {
            setCreating(false);
        }
    }, [newTitle, token]);

    // 5. סימון משימה כבוצעה
    const toggleTask = useCallback(async (task) => {
        const next = !task.isCompleted;
        try {
            const res = await fetch(`${API_BASE}/api/tasks/${task._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                body: JSON.stringify({ isCompleted: next }),
            });
            const updated = await res.json();
            setTasks((prev) => prev.map((t) => (t._id === task._id ? updated : t)));
        } catch (err) {
            setError('עדכון נכשל.');
        }
    }, [token]);

    const listEmpty = useMemo(() => tasks.length === 0, [tasks]);

    // --- תצוגת מסך התחברות (בסגנון המקורי שלך) ---
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

    // --- תצוגת המשימות הראשית (העיצוב המקורי שלך) ---
    return (
        <View style={styles.container}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                    <Text style={styles.brand}>TaskAware</Text>
                    <Text style={styles.subBrand}>ניהול משימות</Text>
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
                    style={styles.input}
                    placeholder="כותרת משימה חדשה..."
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

            <FlatList
                data={tasks}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.taskRow} onPress={() => toggleTask(item)} activeOpacity={0.8}>
                        <Text style={[styles.taskTitle, item.isCompleted ? styles.completedText : null]}>
                            {item.title}
                        </Text>
                        <Text style={styles.statusIcon}>{item.isCompleted ? '✓' : '○'}</Text>
                    </TouchableOpacity>
                )}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={listEmpty && styles.emptyContainer}
                ListEmptyComponent={<Text style={styles.emptyText}>אין משימות כרגע</Text>}
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