import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text,
    TextInput, TouchableOpacity, View, SafeAreaView, KeyboardAvoidingView, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'https://taskaware-backend.onrender.com';

export default function App() {
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tasks, setTasks] = useState([]);
    const [newTitle, setNewTitle] = useState('');
    const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // 1. בדיקת טוקן שמור בעלייה
    useEffect(() => {
        const checkToken = async () => {
            const savedToken = await AsyncStorage.getItem('userToken');
            if (savedToken) setToken(savedToken);
            setLoading(false);
        };
        checkToken();
    }, []);

    // 2. פונקציית התחברות/הרשמה
    const handleAuth = async () => {
        setError('');
        const endpoint = authMode === 'login' ? '/api/login' : '/api/signup';
        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.msg || 'משהו השתבש');

            if (authMode === 'login') {
                await AsyncStorage.setItem('userToken', data.token);
                setToken(data.token);
            } else {
                alert('נרשמת בהצלחה! כעת התחבר');
                setAuthMode('login');
            }
        } catch (err) {
            setError(err.message);
        }
    };

    // 3. שליפת משימות
    const fetchTasks = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE}/api/tasks`, {
                headers: { 'x-access-token': token }
            });
            if (res.status === 401) logout();
            const data = await res.json();
            setTasks(data);
        } catch (err) {
            setError('שגיאה בטעינת משימות');
        }
    }, [token]);

    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    const logout = async () => {
        await AsyncStorage.removeItem('userToken');
        setToken(null);
        setTasks([]);
    };

    // --- תצוגת מסך התחברות ---
    if (!token) {
        return (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
                <SafeAreaView style={styles.authBox}>
                    <Text style={styles.brand}>TaskAware</Text>
                    <Text style={styles.subBrand}>{authMode === 'login' ? 'התחברות' : 'הרשמה למערכת'}</Text>

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

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <TouchableOpacity style={styles.mainBtn} onPress={handleAuth}>
                        <Text style={styles.mainBtnText}>{authMode === 'login' ? 'כניסה' : 'צור חשבון'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>
                        <Text style={styles.switchText}>
                            {authMode === 'login' ? 'אין לך חשבון? הירשם כאן' : 'כבר יש לך חשבון? התחבר'}
                        </Text>
                    </TouchableOpacity>
                </SafeAreaView>
            </KeyboardAvoidingView>
        );
    }

    // --- תצוגת מסך המשימות (כפי שהיה קודם, עם כפתור Logout) ---
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.brand}>המשימות שלי</Text>
                    <Text style={styles.subBrand}>שלום, {username}</Text>
                </View>
                <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                    <Text style={styles.logoutText}>יציאה</Text>
                </TouchableOpacity>
            </View>

            {/* כאן יבוא שאר הקוד של רשימת המשימות וה-TextInput שכתבנו קודם... */}
            <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    placeholder="משימה חדשה..."
                    value={newTitle}
                    onChangeText={setNewTitle}
                    onSubmitEditing={() => {/* קריאה ל-createTask */ }}
                />
            </View>
            <FlatList
                data={tasks}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => <Text style={styles.taskRow}>{item.title}</Text>}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB', padding: 20 },
    authBox: { flex: 1, justifyContent: 'center', gap: 15 },
    brand: { fontSize: 32, fontWeight: 'bold', color: '#111827', textAlign: 'center' },
    subBrand: { fontSize: 18, color: '#6B7280', textAlign: 'center', marginBottom: 20 },
    input: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 16 },
    mainBtn: { backgroundColor: '#2f855a', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    mainBtnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    errorText: { color: '#dc2626', textAlign: 'center' },
    switchText: { color: '#2f855a', textAlign: 'center', marginTop: 15 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 20 },
    logoutBtn: { padding: 8 },
    logoutText: { color: '#ef4444', fontWeight: 'bold' },
    taskRow: { backgroundColor: '#FFF', padding: 15, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
    inputRow: { marginBottom: 20 }
});