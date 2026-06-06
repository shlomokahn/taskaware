import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    TouchableOpacity, 
    StyleSheet, 
    Alert, 
    ActivityIndicator, 
    Linking, 
    ScrollView, 
    Image, 
    Modal, 
    TextInput, 
    KeyboardAvoidingView, 
    Platform 
} from 'react-native';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen({ 
    username, 
    setUsername, 
    handleLogout, 
    onOpenContextManager, 
    onOpenNotificationSettings, 
    token, 
    API_BASE 
}) {
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
    const [expandedPrivacy, setExpandedPrivacy] = useState(false);
    
    // Telegram State
    const [isTelegramLinked, setIsTelegramLinked] = useState(false);
    const [linkingCode, setLinkingCode] = useState(null);
    const [isGeneratingCode, setIsGeneratingCode] = useState(false);
    const [expandedTelegram, setExpandedTelegram] = useState(false);
    
    // WhatsApp State
    const [isWhatsappLinked, setIsWhatsappLinked] = useState(false);
    const [whatsappLinkingCode, setWhatsappLinkingCode] = useState(null);
    const [isGeneratingWhatsappCode, setIsGeneratingWhatsappCode] = useState(false);
    const [expandedWhatsapp, setExpandedWhatsapp] = useState(false);

    // Profile Settings State
    const [profilePicture, setProfilePicture] = useState(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    
    // Username Modal State
    const [usernameModalVisible, setUsernameModalVisible] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [isSavingUsername, setIsSavingUsername] = useState(false);
    const [usernameError, setUsernameError] = useState('');

    // Password Modal State
    const [passwordModalVisible, setPasswordModalVisible] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');

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
                setProfilePicture(data.profilePicture || null);
            }
        } catch (err) {
            console.error('Error fetching settings:', err);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, [token, API_BASE]);

    // Image Picker handler
    const handlePickImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            Alert.alert('Permission Denied', 'Permission to access gallery is required to select a profile picture.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const selectedAsset = result.assets[0];
            const base64Str = `data:image/jpeg;base64,${selectedAsset.base64}`;
            
            setIsUploadingImage(true);
            try {
                const res = await fetch(`${API_BASE}/api/profile/settings/`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Token ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ profilePicture: base64Str }),
                });

                if (res.ok) {
                    const data = await res.json();
                    setProfilePicture(data.profilePicture);
                    Alert.alert('Success', 'Profile picture updated successfully!');
                } else {
                    Alert.alert('Error', 'Failed to save profile picture.');
                }
            } catch (err) {
                Alert.alert('Error', 'Network error saving profile picture.');
            } finally {
                setIsUploadingImage(false);
            }
        }
    };

    // Save Username handler
    const handleSaveUsername = async () => {
        if (!newUsername.trim()) {
            setUsernameError('Username cannot be empty.');
            return;
        }
        if (newUsername.trim() === username) {
            setUsernameModalVisible(false);
            return;
        }

        setIsSavingUsername(true);
        setUsernameError('');
        try {
            const res = await fetch(`${API_BASE}/api/profile/settings/`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: newUsername.trim() }),
            });

            if (res.ok) {
                const data = await res.json();
                const updatedUsername = data.username;
                
                await AsyncStorage.setItem('username', updatedUsername);
                setUsername(updatedUsername);
                
                setUsernameModalVisible(false);
                Alert.alert('Success', 'Username updated successfully!');
            } else {
                const errData = await res.json();
                if (errData.username) {
                    setUsernameError(Array.isArray(errData.username) ? errData.username[0] : errData.username);
                } else {
                    setUsernameError('Failed to update username.');
                }
            }
        } catch (err) {
            setUsernameError('Network error updating username.');
        } finally {
            setIsSavingUsername(false);
        }
    };

    // Save Password handler
    const handleSavePassword = async () => {
        if (!currentPassword) {
            setPasswordError('Current password is required.');
            return;
        }
        if (!newPassword) {
            setPasswordError('New password is required.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match.');
            return;
        }

        setIsSavingPassword(true);
        setPasswordError('');
        try {
            const res = await fetch(`${API_BASE}/api/profile/settings/`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    currentPassword: currentPassword,
                    newPassword: newPassword,
                }),
            });

            if (res.ok) {
                setPasswordModalVisible(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                Alert.alert('Success', 'Password updated successfully!');
            } else {
                const errData = await res.json();
                if (errData.currentPassword) {
                    setPasswordError(Array.isArray(errData.currentPassword) ? errData.currentPassword[0] : errData.currentPassword);
                } else if (errData.detail) {
                    setPasswordError(errData.detail);
                } else {
                    setPasswordError('Failed to update password. Please check your credentials.');
                }
            }
        } catch (err) {
            setPasswordError('Network error updating password.');
        } finally {
            setIsSavingPassword(false);
        }
    };

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
                Alert.alert('Disconnected', 'Telegram account disconnected successfully.');
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
                Alert.alert('Disconnected', 'WhatsApp account disconnected successfully.');
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
            const currentVersion = Constants?.expoConfig?.version || '1.0.1';
            const response = await fetch(
                `${API_BASE}/api/check-update/?current_version=${currentVersion}`
            );

            if (!response.ok) {
                throw new Error('Server returned error status');
            }

            const data = await response.json();

            if (data.update_available) {
                if (__DEV__) {
                    Alert.alert(
                        'Update Available (Simulated)',
                        `Version ${data.version} is available. OTA updates are disabled in development mode.\n\nRelease Notes:\n${data.release_notes}`,
                        [{ text: 'OK', onPress: () => setIsCheckingUpdate(false) }]
                    );
                    return;
                }

                const update = await Updates.checkForUpdateAsync();
                if (update.isAvailable) {
                    Alert.alert(
                        'Update Available',
                        `Version ${data.version} is available. Download and install now?\n\nRelease Notes:\n${data.release_notes}`,
                        [
                            { text: 'Later', onPress: () => setIsCheckingUpdate(false) },
                            {
                                text: 'Update',
                                onPress: async () => {
                                    try {
                                        await Updates.fetchUpdateAsync();
                                        await Updates.reloadAsync();
                                    } catch (err) {
                                        Alert.alert('Error', 'Failed to download update.');
                                    } finally {
                                        setIsCheckingUpdate(false);
                                    }
                                }
                            }
                        ]
                    );
                } else {
                    Alert.alert('Up to Date', 'You are running the latest version.');
                    setIsCheckingUpdate(false);
                }
            } else {
                Alert.alert('Up to Date', 'You are running the latest version.');
                setIsCheckingUpdate(false);
            }
        } catch (error) {
            console.error('Check update error:', error);
            Alert.alert('Error', 'Failed to check for updates.');
            setIsCheckingUpdate(false);
        }
    };

    return (
        <ScrollView style={{ flex: 1, backgroundColor: '#f0f5f3' }} contentContainerStyle={styles.settingsContainer}>
            <Text style={styles.settingsTitle}>Settings</Text>

            {/* Profile Premium Card */}
            <View style={styles.profileCard}>
                <View style={styles.avatarContainer}>
                    <TouchableOpacity onPress={handlePickImage} activeOpacity={0.85}>
                        <View style={styles.avatarCircle}>
                            {profilePicture ? (
                                <Image source={{ uri: profilePicture }} style={styles.avatarImage} />
                            ) : (
                                <Text style={styles.avatarText}>{username ? username.charAt(0).toUpperCase() : ''}</Text>
                            )}
                        </View>
                        <View style={styles.cameraBadge}>
                            {isUploadingImage ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.cameraIcon}>📷</Text>
                            )}
                        </View>
                    </TouchableOpacity>
                </View>
                <View style={styles.profileInfoContainer}>
                    <TouchableOpacity style={styles.nameRow} onPress={() => {
                        setNewUsername(username);
                        setUsernameError('');
                        setUsernameModalVisible(true);
                    }} activeOpacity={0.7}>
                        <Text style={styles.profileName}>hello, {username}</Text>
                        <Text style={styles.editPencil}>✏️</Text>
                    </TouchableOpacity>
                    <Text style={styles.profileSub}>Your account is secured & synchronized</Text>
                </View>
            </View>

            {/* Section: Account & Security */}
            <View style={styles.sectionCard}>
                <Text style={styles.sectionHeader}>🔒 Security & Account</Text>
                
                <TouchableOpacity 
                    style={styles.actionRow}
                    onPress={() => {
                        setPasswordError('');
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                        setPasswordModalVisible(true);
                    }}
                >
                    <View style={styles.actionRowLeft}>
                        <Text style={styles.actionEmoji}>🔑</Text>
                        <Text style={styles.actionText}>Change Password</Text>
                    </View>
                    <Text style={styles.arrowIcon}>▶</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.actionRow}
                    onPress={() => {
                        setNewUsername(username);
                        setUsernameError('');
                        setUsernameModalVisible(true);
                    }}
                >
                    <View style={styles.actionRowLeft}>
                        <Text style={styles.actionEmoji}>👤</Text>
                        <Text style={styles.actionText}>Change Username</Text>
                    </View>
                    <Text style={styles.arrowIcon}>▶</Text>
                </TouchableOpacity>
            </View>

            {/* Section: Preferences */}
            <View style={styles.sectionCard}>
                <Text style={styles.sectionHeader}>⚙️ Preferences & System</Text>
                
                <TouchableOpacity style={styles.actionRow} onPress={onOpenNotificationSettings}>
                    <View style={styles.actionRowLeft}>
                        <Text style={styles.actionEmoji}>🔔</Text>
                        <Text style={styles.actionText}>Manage Notifications & Radius</Text>
                    </View>
                    <Text style={styles.arrowIcon}>▶</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionRow} onPress={onOpenContextManager}>
                    <View style={styles.actionRowLeft}>
                        <Text style={styles.actionEmoji}>📍</Text>
                        <Text style={styles.actionText}>Manage Locations & Contexts</Text>
                    </View>
                    <Text style={styles.arrowIcon}>▶</Text>
                </TouchableOpacity>
            </View>

            {/* Section: Telegram Bot Integration */}
            <View style={styles.cardContainer}>
                <TouchableOpacity 
                    style={styles.expandableHeader}
                    onPress={() => setExpandedTelegram(!expandedTelegram)}
                    activeOpacity={0.7}
                >
                    <View style={styles.headerLeft}>
                        <Text style={styles.actionEmoji}>✈️</Text>
                        <Text style={styles.settingsItemText}>Telegram Bot Integration</Text>
                    </View>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                        {isTelegramLinked && <Text style={styles.statusConnected}>Connected 🟢</Text>}
                        <Text style={[styles.expandIcon, {marginRight: 8}]}>{expandedTelegram ? '▼' : '▶'}</Text>
                    </View>
                </TouchableOpacity>

                {expandedTelegram && (
                    <View style={styles.nestedTelegramContainer}>
                        {isTelegramLinked ? (
                            <View>
                                <Text style={styles.telegramSubText}>
                                    Your Telegram account is successfully connected to TaskAware. You can now send text messages and voice notes directly to the bot.
                                </Text>
                                <TouchableOpacity 
                                    style={[styles.telegramActionBtn, { marginBottom: 12 }]}
                                    onPress={() => Linking.openURL('https://t.me/taskaware1_bot')}
                                >
                                    <Text style={styles.telegramActionBtnText}>Open Telegram Chat 🚀</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={styles.disconnectBtn}
                                    onPress={handleDisconnectTelegram}
                                >
                                    <Text style={styles.disconnectBtnText}>Disconnect Telegram 📴</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View>
                                <Text style={styles.telegramSubText}>
                                    Connect TaskAware to our Telegram Bot to manage tasks using text commands or voice messages.
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

            {/* Section: WhatsApp Bot Integration */}
            <View style={styles.cardContainer}>
                <TouchableOpacity 
                    style={styles.expandableHeader}
                    onPress={() => setExpandedWhatsapp(!expandedWhatsapp)}
                    activeOpacity={0.7}
                >
                    <View style={styles.headerLeft}>
                        <Text style={styles.actionEmoji}>💬</Text>
                        <Text style={styles.settingsItemText}>WhatsApp Bot Integration</Text>
                    </View>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                        {isWhatsappLinked && <Text style={styles.statusConnected}>Connected 🟢</Text>}
                        <Text style={[styles.expandIcon, {marginRight: 8}]}>{expandedWhatsapp ? '▼' : '▶'}</Text>
                    </View>
                </TouchableOpacity>

                {expandedWhatsapp && (
                    <View style={styles.nestedTelegramContainer}>
                        {isWhatsappLinked ? (
                            <View>
                                <Text style={styles.telegramSubText}>
                                    Your WhatsApp account is successfully connected to TaskAware. You can now send text messages and voice notes directly to the bot.
                                </Text>
                                <TouchableOpacity 
                                    style={[styles.telegramActionBtn, { marginBottom: 12 }]}
                                    onPress={() => Linking.openURL('https://wa.me/972505970204')}
                                >
                                    <Text style={styles.telegramActionBtnText}>Open WhatsApp Chat 🚀</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={styles.disconnectBtn}
                                    onPress={handleDisconnectWhatsapp}
                                >
                                    <Text style={styles.disconnectBtnText}>Disconnect WhatsApp 📴</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View>
                                <Text style={styles.telegramSubText}>
                                    Connect TaskAware to your WhatsApp Bot to add tasks using text or voice messages.
                                </Text>

                                {whatsappLinkingCode ? (
                                    <View style={styles.codeWrapper}>
                                        <Text style={styles.codeLabel}>Your Link Code:</Text>
                                        <Text style={styles.codeText}>{whatsappLinkingCode}</Text>
                                        <Text style={styles.expiryNote}>Expires in 10 minutes</Text>
                                        
                                        <Text style={[styles.telegramSubText, {textAlign: 'center', marginBottom: 15, fontWeight: 'bold', color: '#064e3b'}]}>
                                            Send this code as a WhatsApp message to your Bot's number to complete the connection.
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

            {/* System updates */}
            <View style={styles.sectionCard}>
                <TouchableOpacity 
                    style={styles.actionRow} 
                    onPress={handleCheckUpdate}
                    disabled={isCheckingUpdate}
                >
                    <View style={styles.actionRowLeft}>
                        <Text style={styles.actionEmoji}>🔄</Text>
                        <Text style={styles.actionText}>Check for Updates</Text>
                    </View>
                    {isCheckingUpdate ? (
                        <ActivityIndicator color="#059669" />
                    ) : (
                        <Text style={styles.arrowIcon}>▶</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Logout button */}
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
                <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>


            {/* ================= MODALS ================= */}

            {/* Edit Username Modal */}
            <Modal
                visible={usernameModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setUsernameModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} 
                        style={styles.modalContent}
                    >
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
                            <Text style={styles.modalTitle}>Change Username</Text>
                            <Text style={styles.modalSubtitle}>Choose a new unique username for your account.</Text>
                            
                            <TextInput
                                style={styles.modalInput}
                                placeholder="New Username"
                                placeholderTextColor="#9ca3af"
                                value={newUsername}
                                onChangeText={setNewUsername}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            
                            {usernameError ? <Text style={styles.modalError}>{usernameError}</Text> : null}
                            
                            <View style={styles.modalButtons}>
                                <TouchableOpacity 
                                    style={[styles.modalBtn, styles.cancelBtn]} 
                                    onPress={() => setUsernameModalVisible(false)}
                                    disabled={isSavingUsername}
                                >
                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.modalBtn, styles.saveBtn]} 
                                    onPress={handleSaveUsername}
                                    disabled={isSavingUsername}
                                >
                                    {isSavingUsername ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.saveBtnText}>Save Changes</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Edit Password Modal */}
            <Modal
                visible={passwordModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setPasswordModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} 
                        style={styles.modalContent}
                    >
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
                            <Text style={styles.modalTitle}>Change Password</Text>
                            <Text style={styles.modalSubtitle}>Please verify your current password and type a new password.</Text>
                            
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Current Password"
                                placeholderTextColor="#9ca3af"
                                secureTextEntry={true}
                                value={currentPassword}
                                onChangeText={setCurrentPassword}
                            />

                            <TextInput
                                style={styles.modalInput}
                                placeholder="New Password"
                                placeholderTextColor="#9ca3af"
                                secureTextEntry={true}
                                value={newPassword}
                                onChangeText={setNewPassword}
                            />

                            <TextInput
                                style={styles.modalInput}
                                placeholder="Confirm New Password"
                                placeholderTextColor="#9ca3af"
                                secureTextEntry={true}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                            />
                            
                            {passwordError ? <Text style={styles.modalError}>{passwordError}</Text> : null}
                            
                            <View style={styles.modalButtons}>
                                <TouchableOpacity 
                                    style={[styles.modalBtn, styles.cancelBtn]} 
                                    onPress={() => setPasswordModalVisible(false)}
                                    disabled={isSavingPassword}
                                >
                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.modalBtn, styles.saveBtn]} 
                                    onPress={handleSavePassword}
                                    disabled={isSavingPassword}
                                >
                                    {isSavingPassword ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.saveBtnText}>Update Password</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    settingsContainer: { 
        padding: 20, 
        paddingBottom: 50,
    },
    settingsTitle: { 
        fontSize: 28, 
        fontWeight: '900', 
        color: '#064e3b', 
        textAlign: 'left', 
        marginBottom: 25,
        letterSpacing: 0.5,
    },
    profileCard: { 
        backgroundColor: '#064e3b', 
        padding: 25, 
        borderRadius: 24, 
        alignItems: 'center', 
        marginBottom: 20, 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1, 
        shadowRadius: 12, 
        elevation: 4,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 15,
    },
    avatarCircle: { 
        width: 90, 
        height: 90, 
        borderRadius: 45, 
        backgroundColor: '#ecfdf5', 
        justifyContent: 'center', 
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#34d399',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarText: { 
        fontSize: 36, 
        fontWeight: 'bold', 
        color: '#059669' 
    },
    cameraBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#10b981',
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#064e3b',
    },
    cameraIcon: {
        fontSize: 13,
        color: '#fff',
    },
    profileInfoContainer: {
        alignItems: 'center',
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileName: { 
        fontSize: 22, 
        fontWeight: 'bold', 
        color: '#ffffff',
        textAlign: 'center',
    },
    editPencil: {
        fontSize: 16,
        marginLeft: 6,
        opacity: 0.85,
    },
    profileSub: { 
        fontSize: 13, 
        color: '#a7f3d0', 
        marginTop: 4,
        opacity: 0.9,
    },
    sectionCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 8,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    sectionHeader: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#064e3b',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
        textAlign: 'left',
        opacity: 0.8,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    actionRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionEmoji: {
        fontSize: 18,
        marginRight: 12,
    },
    actionText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
    arrowIcon: {
        fontSize: 11,
        color: '#9ca3af',
        fontWeight: 'bold',
    },
    cardContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        marginBottom: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    expandableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    settingsItemText: { 
        fontSize: 15, 
        fontWeight: '600', 
        color: '#374151', 
        marginLeft: 12,
    },
    statusConnected: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#059669',
        backgroundColor: '#d1fae5',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 20,
        overflow: 'hidden',
    },
    expandIcon: { 
        fontSize: 11, 
        color: '#9ca3af', 
        fontWeight: '700',
    },
    nestedTelegramContainer: {
        backgroundColor: '#f8fafc',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    telegramSubText: {
        fontSize: 13,
        color: '#475569',
        lineHeight: 18,
        marginBottom: 15,
        textAlign: 'left',
    },
    codeWrapper: {
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 5,
        elevation: 1,
    },
    codeLabel: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: 'bold',
        marginBottom: 4,
    },
    codeText: {
        fontSize: 34,
        fontWeight: 'bold',
        color: '#059669',
        letterSpacing: 6,
        marginVertical: 6,
    },
    expiryNote: {
        fontSize: 10,
        color: '#94a3b8',
        marginBottom: 15,
    },
    telegramActionBtn: {
        backgroundColor: '#059669',
        paddingVertical: 12,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
    },
    telegramActionBtnText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 15,
    },
    checkConnBtn: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 11,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
        marginTop: 10,
    },
    checkConnBtnText: {
        color: '#475569',
        fontWeight: '700',
        fontSize: 13,
    },
    disconnectBtn: {
        backgroundColor: '#fee2e2',
        paddingVertical: 12,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
    },
    disconnectBtnText: {
        color: '#ef4444',
        fontWeight: 'bold',
        fontSize: 14,
    },
    generateBtn: {
        backgroundColor: '#059669',
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    generateBtnText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    logoutBtn: { 
        marginTop: 15, 
        marginBottom: 40, 
        backgroundColor: '#fee2e2', 
        padding: 16, 
        borderRadius: 18, 
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#fca5a5',
    },
    logoutText: { 
        color: '#ef4444', 
        fontWeight: 'bold', 
        fontSize: 15,
    },

    // Modal Styling
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)', // sleek dark overlay
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxHeight: '85%',
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#064e3b',
        textAlign: 'left',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'left',
        lineHeight: 18,
        marginBottom: 20,
    },
    modalInput: {
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        color: '#1e293b',
        textAlign: 'left',
        marginBottom: 12,
        backgroundColor: '#f8fafc',
    },
    modalError: {
        color: '#ef4444',
        fontSize: 12,
        textAlign: 'left',
        marginBottom: 12,
        fontWeight: '600',
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    modalBtn: {
        flex: 0.48,
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtn: {
        backgroundColor: '#f1f5f9',
    },
    cancelBtnText: {
        color: '#475569',
        fontWeight: 'bold',
        fontSize: 14,
    },
    saveBtn: {
        backgroundColor: '#059669',
    },
    saveBtnText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 14,
    },
});