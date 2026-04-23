import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function SettingsScreen({ username, handleLogout, handleLocationSync, isSyncing }) {
    return (
        <View style={styles.settingsContainer}>
            <Text style={styles.settingsTitle}>Settings</Text>

            <View style={styles.profileCard}>
                <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{username ? username.charAt(0).toUpperCase() : ''}</Text>
                </View>
                <Text style={styles.profileName}>שלום, {username}</Text>
                <Text style={styles.profileSub}>Your user is logged in and synchronized</Text>
            </View>

            <View style={styles.settingsList}>
                <TouchableOpacity style={styles.settingsItem}>
                    <Text style={styles.settingsItemText}>🔔 Manage notifications</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.settingsItem}>
                    <Text style={styles.settingsItemText}>🛡️ privacy and security</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.settingsItem} onPress={handleLocationSync} disabled={isSyncing}>
                    <Text style={styles.settingsItemText}>{isSyncing ? '⏳ Synchronizes location...' : '📍 Location synchronization'}</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.logoutFullBtn} onPress={handleLogout}>
                <Text style={styles.logoutFullText}>Log out</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
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
});