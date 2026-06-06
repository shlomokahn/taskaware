import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Linking, ScrollView } from 'react-native';
import * as Updates from 'expo-updates';

export default function SettingsScreen({ username, handleLogout, onOpenContextManager, onOpenNotificationSettings, token, API_BASE }) {
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
    const [expandedPrivacy, setExpandedPrivacy] = useState(false);
    const [isTelegramLinked, setIsTelegramLinked] = useState(false);
    const [linkingCode, setLinkingCode] = useState(null);
    const [isGeneratingCode, setIsGeneratingCode] = useState(false);
    const [expandedTelegram, setExpandedTelegram] = useState(false);
    const [isWhatsappLinked, setIsWhatsappLinked] = useState(false);
    const [whatsappLinkingCode, setWhatsappLinkingCode] = useState(null);
    const [isGeneratingWhatsappCode, setIsGeneratingWhatsappCode] = useState(false);
    const [expandedWhatsapp, setExpandedWhatsapp] = useState(false);

    const fetchSettings = async () => {
        if (!token || !API_BASE) return;
        try {
            const res = await fetch(`${API_BASE}/api/profile/settings/`, {
                headers: { 'Authorization': `Token ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setIsTelegramLinked(data.isTelegramLinked || false);
                setIsWhatsappLinked(data.isWhatsappLinked || false);
            }
        } catch (err) {
            console.error('Error fetching settings:', err);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, [token, API_BASE]);

    const handleConnectTelegram = async () => {
        setIsGeneratingCode(true);
        try {
            const res = await fetch(`${API_BASE}/api/profile/telegram-link-code/`, {
                method: 'POST',
                headers: { 'Authorization': `Token ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setLinkingCode(data.code);
            } else {
                Alert.alert('Error', 'Failed to generate code');
            }
        } catch (err) {
            Alert.alert('Error', 'Network error generating code');
        } finally {
            setIsGeneratingCode(false);
        }
    };

    const handleConnectWhatsapp = async () => {
        setIsGeneratingWhatsappCode(true);
        try {
            const res = await fetch(`${API_BASE}/api/profile/whatsapp-link-code/`, {
                method: 'POST',
                headers: { 'Authorization': `Token ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setWhatsappLinkingCode(data.code);
            } else {
                Alert.alert('Error', 'Failed to generate code');
            }
        } catch (err) {
            Alert.alert('Error', 'Network error generating code');
        } finally {
            setIsGeneratingWhatsappCode(false);
        }
    };

    const handleDisconnectTelegram = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/profile/settings/`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ telegramChatId: null })
            });
            if (res.ok) {
                setIsTelegramLinked(false);
                setLinkingCode(null);
                Alert.alert('Disconnected', 'Telegram account disconnected successfully');
            } else {
                Alert.alert('Error', 'Failed to disconnect');
            }
        } catch (err) {
            Alert.alert('Error', 'Network error disconnecting');
        }
    };

    const handleDisconnectWhatsapp = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/profile/settings/`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ whatsappNumber: null })
            });
            if (res.ok) {
                setIsWhatsappLinked(false);
                setWhatsappLinkingCode(null);
                Alert.alert('Disconnected', 'WhatsApp account disconnected successfully');
            } else {
                Alert.alert('Error', 'Failed to disconnect');
            }
        } catch (err) {
            Alert.alert('Error', 'Network error disconnecting');
        }
    };

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
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.settingsContainer}>
            <Text style={styles.settingsTitle}>Settings</Text>

            <View style={styles.profileCard}>
                <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{username ? username.charAt(0).toUpperCase() : ''}</Text>
                </View>
                <Text style={styles.profileName}>hello {username}</Text>
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

                {/* Telegram Bot Integration */}
                <View style={styles.cardContainer}>
                    <TouchableOpacity 
                        style={styles.settingsItem}
                        onPress={() => setExpandedTelegram(!expandedTelegram)}
                    >
                        <View style={styles.itemContent}>
                            <Text style={styles.settingsItemText}>💬 Telegram Integration</Text>
                            {isTelegramLinked ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={[styles.statusConnected, {marginRight: 8}]}>Connected 🟢</Text>
                                    <Text style={styles.expandIcon}>{expandedTelegram ? '▼' : '▶'}</Text>
                                </View>
                            ) : (
                                <Text style={styles.expandIcon}>{expandedTelegram ? '▼' : '▶'}</Text>
                            )}
                        </View>
                    </TouchableOpacity>

                    {expandedTelegram && (
                        <View style={styles.nestedTelegramContainer}>
                            {isTelegramLinked ? (
                                <View>
                                    <Text style={styles.telegramSubText}>
                                        Your Telegram account is successfully connected to TaskAware.
                                    </Text>
                                    <TouchableOpacity 
                                        style={[styles.logoutFullBtn, { marginTop: 10, marginBottom: 0 }]}
                                        onPress={handleDisconnectTelegram}
                                    >
                                        <Text style={styles.logoutFullText}>Disconnect Telegram 📴</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View>
                                    <Text style={styles.telegramSubText}>
                                        Connect TaskAware to our Telegram Bot to add tasks using voice or text.
                                    </Text>

                                    {linkingCode ? (
                                        <View style={styles.codeWrapper}>
                                            <Text style={styles.codeLabel}>Your Link Code:</Text>
                                            <Text style={styles.codeText}>{linkingCode}</Text>
                                            <Text style={styles.expiryNote}>Expires in 10 minutes</Text>
                                            
                                            <TouchableOpacity 
                                                style={styles.telegramActionBtn}
                                                onPress={() => Linking.openURL(`https://t.me/taskaware1_bot?start=link_${linkingCode}`)}
                                            >
                                                <Text style={styles.telegramActionBtnText}>Open Telegram Bot 🚀</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity 
                                                style={styles.checkConnBtn}
                                                onPress={fetchSettings}
                                            >
                                                <Text style={styles.checkConnBtnText}>Check Connection 🔄</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <TouchableOpacity 
                                            style={styles.generateBtn}
                                            onPress={handleConnectTelegram}
                                            disabled={isGeneratingCode}
                                        >
                                            {isGeneratingCode ? (
                                                <ActivityIndicator color="#fff" />
                                            ) : (
                                                <Text style={styles.generateBtnText}>Generate Link Code</Text>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>
                    )}
                </View>

                {/* WhatsApp Bot Integration */}
                <View style={styles.cardContainer}>
                    <TouchableOpacity 
                        style={styles.settingsItem}
                        onPress={() => setExpandedWhatsapp(!expandedWhatsapp)}
                    >
                        <View style={styles.itemContent}>
                            <Text style={styles.settingsItemText}>💬 WhatsApp Integration</Text>
                            {isWhatsappLinked ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={[styles.statusConnected, {marginRight: 8}]}>Connected 🟢</Text>
                                    <Text style={styles.expandIcon}>{expandedWhatsapp ? '▼' : '▶'}</Text>
                                </View>
                            ) : (
                                <Text style={styles.expandIcon}>{expandedWhatsapp ? '▼' : '▶'}</Text>
                            )}
                        </View>
                    </TouchableOpacity>

                    {expandedWhatsapp && (
                        <View style={styles.nestedTelegramContainer}>
                            {isWhatsappLinked ? (
                                <View>
                                    <Text style={styles.telegramSubText}>
                                        Your WhatsApp account is successfully connected to TaskAware.
                                    </Text>
                                    <TouchableOpacity 
                                        style={[styles.logoutFullBtn, { marginTop: 10, marginBottom: 0 }]}
                                        onPress={handleDisconnectWhatsapp}
                                    >
                                        <Text style={styles.logoutFullText}>Disconnect WhatsApp 📴</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View>
                                    <Text style={styles.telegramSubText}>
                                        Connect TaskAware to your WhatsApp Bot to add tasks using voice or text.
                                    </Text>

                                    {whatsappLinkingCode ? (
                                        <View style={styles.codeWrapper}>
                                            <Text style={styles.codeLabel}>Your Link Code:</Text>
                                            <Text style={styles.codeText}>{whatsappLinkingCode}</Text>
                                            <Text style={styles.expiryNote}>Expires in 10 minutes</Text>
                                            
                                            <Text style={[styles.telegramSubText, {textAlign: 'center', marginBottom: 15, fontWeight: 'bold'}]}>
                                                Send this code as a WhatsApp message to your Bot's number to connect.
                                            </Text>

                                            <TouchableOpacity 
                                                style={styles.checkConnBtn}
                                                onPress={fetchSettings}
                                            >
                                                <Text style={styles.checkConnBtnText}>Check Connection 🔄</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <TouchableOpacity 
                                            style={styles.generateBtn}
                                            onPress={handleConnectWhatsapp}
                                            disabled={isGeneratingWhatsappCode}
                                        >
                                            {isGeneratingWhatsappCode ? (
                                                <ActivityIndicator color="#fff" />
                                            ) : (
                                                <Text style={styles.generateBtnText}>Generate Link Code</Text>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>
                    )}
                </View>

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
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    settingsContainer: { padding: 25, paddingBottom: 60 },
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
    logoutFullBtn: { marginTop: 25, marginBottom: 40, backgroundColor: '#fee2e2', padding: 18, borderRadius: 16, alignItems: 'center' },
    logoutFullText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
    cardContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 5,
        elevation: 1,
    },
    statusConnected: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#059669',
    },
    nestedTelegramContainer: {
        backgroundColor: '#f9fafb',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
    },
    telegramSubText: {
        fontSize: 14,
        color: '#6b7280',
        lineHeight: 20,
        marginBottom: 15,
        textAlign: 'left',
    },
    codeWrapper: {
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 18,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    codeLabel: {
        fontSize: 13,
        color: '#9ca3af',
        fontWeight: 'bold',
        marginBottom: 6,
    },
    codeText: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#2f855a',
        letterSpacing: 8,
        marginVertical: 5,
    },
    expiryNote: {
        fontSize: 11,
        color: '#9ca3af',
        marginBottom: 15,
    },
    telegramActionBtn: {
        backgroundColor: '#2f855a',
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 10,
        width: '100%',
        alignItems: 'center',
        marginBottom: 10,
    },
    telegramActionBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 15,
    },
    checkConnBtn: {
        backgroundColor: '#f3f4f6',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
        width: '100%',
        alignItems: 'center',
    },
    checkConnBtnText: {
        color: '#4b5563',
        fontWeight: '700',
        fontSize: 13,
    },
    generateBtn: {
        backgroundColor: '#2f855a',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    generateBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 15,
    },
});