import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as Updates from 'expo-updates';

export default function SettingsScreen({ username, handleLogout, handleLocationSync, isSyncing, onOpenContextManager, onOpenNotificationSettings }) {
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
    const [expandedPrivacy, setExpandedPrivacy] = useState(false);

    const handleCheckUpdate = async () => {
        setIsCheckingUpdate(true);
        try {
            const update = await Updates.checkForUpdateAsync();
            if (update.isAvailable) {
                Alert.alert(
                    'Update Available',
                    'A new version is available. Download and install now?',
                    [
                        { text: 'Later', onPress: () => setIsCheckingUpdate(false) },
                        {
                            text: 'Update',
                            onPress: async () => {
                                await Updates.fetchUpdateAsync();
                                await Updates.reloadAsync();
                            }
                        }
                    ]
                );
            } else {
                Alert.alert('Up to Date', 'You are running the latest version');
                setIsCheckingUpdate(false);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to check for updates');
            setIsCheckingUpdate(false);
        }
    };

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
                <TouchableOpacity style={styles.settingsItem} onPress={onOpenNotificationSettings}>
                    <Text style={styles.settingsItemText}>🔔 Manage notifications</Text>
                </TouchableOpacity>

                <View>
                    <TouchableOpacity 
                        style={styles.settingsItem}
                        onPress={() => setExpandedPrivacy(!expandedPrivacy)}
                    >
                        <View style={styles.itemContent}>
                            <Text style={styles.settingsItemText}>🛡️ Privacy and security</Text>
                            <Text style={styles.expandIcon}>{expandedPrivacy ? '▼' : '▶'}</Text>
                        </View>
                    </TouchableOpacity>

                    {expandedPrivacy && (
                        <View style={styles.nestedItems}>
                            <TouchableOpacity 
                                style={styles.nestedItem}
                                onPress={onOpenContextManager}
                            >
                                <Text style={styles.nestedItemText}>📍 Manage locations</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <TouchableOpacity style={styles.settingsItem} onPress={handleLocationSync} disabled={isSyncing}>
                    <Text style={styles.settingsItemText}>{isSyncing ? '⏳ Synchronizing location...' : '📍 Location synchronization'}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.settingsItem} 
                    onPress={handleCheckUpdate}
                    disabled={isCheckingUpdate}
                >
                    {isCheckingUpdate ? (
                        <ActivityIndicator color="#2f855a" />
                    ) : (
                        <Text style={styles.settingsItemText}>🔄 Check for Updates</Text>
                    )}
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
    settingsItem: { backgroundColor: '#fff', padding: 20, borderRadius: 16, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
    itemContent: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
    settingsItemText: { fontSize: 16, fontWeight: '600', color: '#374151', flex: 1 },
    expandIcon: { fontSize: 12, color: '#9ca3af', fontWeight: '700' },
    nestedItems: { backgroundColor: '#f9fafb', marginTop: 8, borderRadius: 12, overflow: 'hidden' },
    nestedItem: { backgroundColor: '#fff', padding: 16, paddingLeft: 24, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', flexDirection: 'row-reverse', alignItems: 'center' },
    nestedItemText: { fontSize: 15, fontWeight: '500', color: '#6b7280' },
    logoutFullBtn: { marginTop: 'auto', marginBottom: 100, backgroundColor: '#fee2e2', padding: 18, borderRadius: 16, alignItems: 'center' },
    logoutFullText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
});