import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen({ API_BASE, setToken, setUsername }) {
    const [localUsername, setLocalUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoginMode, setIsLoginMode] = useState(true);
    const [isAuthLoading, setIsAuthLoading] = useState(false);

    const handleAuth = async () => {
        if (!localUsername || !password) { Alert.alert("error", "Please enter a username and password."); return; }
        setIsAuthLoading(true);
        const path = isLoginMode ? '/api/login/' : '/api/signup/';
        try {
            const res = await fetch(`${API_BASE}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: localUsername, password }),
            });
            const textResponse = await res.text();
            if (!res.ok) { Alert.alert("Server error", "The request failed"); return; }
            const data = JSON.parse(textResponse);
            if (data.token) {
                await AsyncStorage.setItem('userToken', data.token);
                await AsyncStorage.setItem('username', localUsername);
                setUsername(localUsername);
                setToken(data.token);
            } else {
                Alert.alert("error", "Incorrect login details");
            }
        } catch (e) {
            Alert.alert("Network error", "Connection to server failed.");
        } finally {
            setIsAuthLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.loginContainer}>
            <View style={styles.loginCard}>
                <Text style={styles.loginBrand}>TaskAware</Text>

                <Text style={styles.label}>Username</Text>
                <TextInput style={styles.loginInput} placeholder="Enter username" value={localUsername} onChangeText={setLocalUsername} autoCapitalize="none" />

                <Text style={styles.label}>Password</Text>
                <TextInput style={styles.loginInput} placeholder="Enter password" secureTextEntry value={password} onChangeText={setPassword} />

                <TouchableOpacity style={styles.loginBtn} disabled={isAuthLoading} onPress={handleAuth}>
                    {isAuthLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>{isLoginMode ? 'Login' : 'Sign Up'}</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsLoginMode(!isLoginMode)}>
                    <Text style={styles.switchModeText}>{isLoginMode ? "Don't have an account? Go to sign up" : 'Do you have an account? Go to login'}</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    loginContainer: { flex: 1, justifyContent: 'center', backgroundColor: '#f3f4f6', paddingHorizontal: 20 },
    loginCard: { backgroundColor: '#fff', padding: 25, borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 5 },
    loginBrand: { fontSize: 36, fontWeight: '900', textAlign: 'center', marginBottom: 30, color: '#2f855a' },
    label: { fontSize: 16, fontWeight: '600', color: '#2f855a', marginBottom: 8, marginTop: 12, textAlign: 'left' },
    loginInput: { height: 55, backgroundColor: '#f9fafb', borderRadius: 16, paddingHorizontal: 15, marginBottom: 15, borderWidth: 1, borderColor: '#e5e7eb', textAlign: 'left', fontSize: 16 },
    loginBtn: { height: 55, backgroundColor: '#2f855a', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 20, shadowColor: '#2f855a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 },
    loginBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    switchModeText: { textAlign: 'center', marginTop: 20, color: '#4b5563', fontSize: 15, fontWeight: '600' },
});