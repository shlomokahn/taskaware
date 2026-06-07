import React, { useEffect, useState } from 'react';
import { Alert, View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import * as Updates from 'expo-updates';
import * as Application from 'expo-application';

const JS_VERSION = '1.1.0.3';

export default function UpdateChecker({ API_BASE }) {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [updateInfo, setUpdateInfo] = useState(null);
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        checkForUpdates();
        // Check for updates every 24 hours
        const interval = setInterval(checkForUpdates, 24 * 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const checkForUpdates = async () => {
        try {
            const currentVersion = JS_VERSION;

            const response = await fetch(
                `${API_BASE}/api/check-update/?current_version=${currentVersion}`
            );

            if (!response.ok) {
                console.warn('API returned error:', response.status);
                return;
            }

            const data = await response.json();

            if (data.update_available) {
                setUpdateInfo(data);
                setUpdateAvailable(true);
                setShowUpdateModal(true);

                // If mandatory update, show alert immediately
                if (data.is_mandatory) {
                    Alert.alert(
                        'Required Update',
                        `Version ${data.version.startsWith('1.1.0') ? '1.1.0' : data.version} is now available. You must update to continue using the app.`,
                        [
                            {
                                text: 'Update Now',
                                onPress: () => handleUpdate(data),
                                style: 'destructive'
                            }
                        ],
                        { cancelable: false }
                    );
                }
            }
        } catch (error) {
            console.log('Update check failed:', error);
        }
    };

    const handleUpdate = async (updateData) => {
        setIsDownloading(true);
        try {
            if (__DEV__) {
                Alert.alert(
                    'Simulated Update',
                    'OTA updates are simulated and not supported in development mode (Expo Go / Metro). Your local bundle already has the latest code changes!',
                    [{ text: 'OK', onPress: () => setShowUpdateModal(false) }]
                );
                setIsDownloading(false);
                return;
            }

            console.log('Checking and fetching update...');
            const update = await Updates.checkForUpdateAsync();

            if (update.isAvailable) {
                console.log('New update is available. Fetching...');
                await Updates.fetchUpdateAsync();
                console.log('Update fetched successfully. Reloading...');
                await Updates.reloadAsync();
            } else {
                console.log('checkForUpdateAsync says no update is available. Trying direct fetch/reload fallback...');
                try {
                    await Updates.fetchUpdateAsync();
                    await Updates.reloadAsync();
                } catch (fetchErr) {
                    console.log('Direct fetch/reload failed:', fetchErr);
                    try {
                        await Updates.reloadAsync();
                    } catch (reloadErr) {
                        console.log('Direct reload failed:', reloadErr);
                        Alert.alert('Up to date', 'You are running the latest version');
                        setShowUpdateModal(false);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching update:', error);
            try {
                console.log('Attempting reload fallback after error...');
                await Updates.reloadAsync();
            } catch (reloadErr) {
                Alert.alert('Update Error', `Failed to download update: ${error.message || error}`);
            }
        } finally {
            setIsDownloading(false);
        }
    };

    const handleSkip = () => {
        setShowUpdateModal(false);
    };

    return (
        <>
            {updateAvailable && updateInfo && (
                <Modal
                    visible={showUpdateModal}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={updateInfo.is_mandatory ? null : handleSkip}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>?? New Update Available</Text>

                            <Text style={styles.versionText}>
                                Version {updateInfo.version.startsWith('1.1.0') ? '1.1.0' : updateInfo.version}
                            </Text>

                            <Text style={styles.notesTitle}>What's New:</Text>
                            <Text style={styles.releaseNotes}>
                                {updateInfo.release_notes}
                            </Text>

                            {updateInfo.is_mandatory && (
                                <View style={styles.mandatoryBadge}>
                                    <Text style={styles.mandatoryText}>?? Required Update</Text>
                                </View>
                            )}

                            <View style={styles.buttonContainer}>
                                {!updateInfo.is_mandatory && !isDownloading && (
                                    <TouchableOpacity
                                        style={[styles.button, styles.skipButton]}
                                        onPress={handleSkip}
                                    >
                                        <Text style={styles.skipButtonText}>Skip for Now</Text>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    style={[styles.button, styles.updateButton]}
                                    onPress={() => handleUpdate(updateInfo)}
                                    disabled={isDownloading}
                                >
                                    {isDownloading ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.updateButtonText}>Update Now</Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {isDownloading && (
                                <Text style={styles.downloadingText}>Downloading update...</Text>
                            )}
                        </View>
                    </View>
                </Modal>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 25,
        minHeight: 400,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#2f855a',
        marginBottom: 15,
    },
    versionText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
        textAlign: 'center',
        marginBottom: 15,
    },
    notesTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#333',
        marginBottom: 10,
    },
    releaseNotes: {
        fontSize: 14,
        color: '#555',
        lineHeight: 22,
        marginBottom: 20,
    },
    mandatoryBadge: {
        backgroundColor: '#fef3c7',
        borderColor: '#f59e0b',
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
    },
    mandatoryText: {
        color: '#d97706',
        fontWeight: '600',
        textAlign: 'center',
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    skipButton: {
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    skipButtonText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '600',
    },
    updateButton: {
        backgroundColor: '#2f855a',
    },
    updateButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    downloadingText: {
        textAlign: 'center',
        marginTop: 15,
        color: '#2f855a',
        fontSize: 12,
        fontWeight: '600',
    },
});
