import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Alert,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Audio } from 'expo-av';

export default function AddTaskModal({ visible, onClose, onAddTask, creating, token, API_BASE, onVoiceTaskCreated }) {
    const [title, setTitle] = useState('');
    const [reminderDate, setReminderDate] = useState(null);
    const [showReminderPicker, setShowReminderPicker] = useState(false);

    // Audio recording state
    const [recording, setRecording] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);

    useEffect(() => {
        if (visible) {
            setTitle('');
            setReminderDate(null);
            setShowReminderPicker(false);
            setRecording(null);
            setIsRecording(false);
            setIsTranscribing(false);
        }
    }, [visible]);

    useEffect(() => {
        return () => {
            if (recording) {
                recording.stopAndUnloadAsync().catch(err => console.log('Cleanup recording:', err));
            }
        };
    }, [recording]);

    const startRecording = async () => {
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert('Permission Denied', 'Microphone permission is required to record tasks.');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            console.log('Starting audio recording...');
            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            setRecording(newRecording);
            setIsRecording(true);
        } catch (err) {
            console.error('Failed to start recording:', err);
            Alert.alert('Recording Error', 'Failed to start microphone recording.');
        }
    };

    const stopRecording = async () => {
        if (!recording) return;

        console.log('Stopping audio recording...');
        setIsRecording(false);
        setIsTranscribing(true);

        try {
            await recording.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });
            const uri = recording.getURI();
            setRecording(null);

            if (uri) {
                await uploadAudio(uri);
            } else {
                throw new Error('No recording URI found');
            }
        } catch (err) {
            console.error('Failed to stop recording:', err);
            Alert.alert('Recording Error', 'Failed to process voice note.');
            setIsTranscribing(false);
        }
    };

    const uploadAudio = async (uri) => {
        if (!token || !API_BASE) {
            setIsTranscribing(false);
            return;
        }

        try {
            const formData = new FormData();
            const uriParts = uri.split('/');
            const filename = uriParts[uriParts.length - 1];
            
            const fileExtension = filename.split('.').pop();
            let mimeType = 'audio/mp4';
            if (fileExtension === 'm4a') mimeType = 'audio/m4a';
            else if (fileExtension === '3gp') mimeType = 'audio/3gp';
            else if (fileExtension === 'caf') mimeType = 'audio/caf';

            formData.append('file', {
                uri: uri,
                name: filename,
                type: mimeType,
            });

            console.log('Uploading audio to server...');
            const res = await fetch(`${API_BASE}/api/tasks/create-from-voice/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                },
                body: formData,
            });

            const data = await res.json();
            setIsTranscribing(false);

            if (res.ok) {
                if (onVoiceTaskCreated) {
                    onVoiceTaskCreated(data);
                }
            } else {
                console.warn('Voice task upload rejected:', data);
                Alert.alert(
                    'Failed to parse task',
                    data.error || 'AI could not extract task details. Please speak clearly and try again.'
                );
            }
        } catch (error) {
            console.error('Audio upload failed:', error);
            Alert.alert('Upload Error', 'Failed to connect to the server.');
            setIsTranscribing(false);
        }
    };

    const handleMicPress = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const handleAdd = () => {
        onAddTask(title, reminderDate);
    };

    const formatDisplayDate = (date) => {
        if (!date) return 'Not set';
        const d = new Date(date);
        return isNaN(d.getTime()) ? 'Invalid Date' : d.toLocaleString('en-US', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    };

    const openAndroidDate = (targetSetter, baseDate) => {
        DateTimePickerAndroid.open({
            value: baseDate,
            mode: 'date',
            display: 'calendar',
            onChange: (event, selectedDate) => {
                if (event.type === 'set' && selectedDate) {
                    const d = new Date(baseDate);
                    d.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                    targetSetter(d);
                }
            },
        });
    };

    const openAndroidTime = (targetSetter, baseDate) => {
        DateTimePickerAndroid.open({
            value: baseDate,
            mode: 'time',
            is24Hour: true,
            display: 'clock',
            onChange: (event, selectedTime) => {
                if (event.type === 'set' && selectedTime) {
                    const d = new Date(baseDate);
                    d.setHours(selectedTime.getHours(), selectedTime.getMinutes());
                    targetSetter(d);
                }
            },
        });
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.addModalOverlay}>
                <View style={styles.addModalContent}>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Task</Text>
                            <TouchableOpacity onPress={onClose}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={{ height: 12 }} />

                        <View style={styles.inputRow}>
                            <TextInput
                                style={styles.taskInputModal}
                                placeholder="What's your next task?"
                                value={title}
                                onChangeText={setTitle}
                                placeholderTextColor="#9ca3af"
                                autoFocus={true}
                                editable={!creating && !isRecording && !isTranscribing}
                                returnKeyType="done"
                                multiline={false}
                            />
                            <TouchableOpacity
                                style={[
                                    styles.micBtn,
                                    isRecording && styles.micBtnActive,
                                    isTranscribing && styles.micBtnDisabled
                                ]}
                                onPress={handleMicPress}
                                disabled={creating || isTranscribing}
                            >
                                <Text style={styles.micBtnText}>{isRecording ? '🛑' : '🎙️'}</Text>
                            </TouchableOpacity>
                        </View>

                        {isRecording && (
                            <View style={styles.recordingStatus}>
                                <View style={styles.redDot} />
                                <Text style={styles.recordingText}>Recording... Speak clearly now</Text>
                            </View>
                        )}

                        {isTranscribing && (
                            <View style={styles.transcribingStatus}>
                                <ActivityIndicator size="small" color="#2f855a" />
                                <Text style={styles.transcribingText}>AI is transcribing & parsing audio...</Text>
                            </View>
                        )}

                        <View style={{ height: 12 }} />

                        <View style={styles.actionRow}>
                            <TouchableOpacity
                                style={[styles.modalHalfBtn, showReminderPicker && styles.reminderBtnActive]}
                                onPress={() => setShowReminderPicker(prev => !prev)}
                            >
                                <Text style={[styles.modalHalfBtnText, showReminderPicker && styles.reminderBtnTextActive]}>
                                    ⏰ {reminderDate ? 'Reminder set' : 'Add reminder'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.modalHalfBtn, styles.modalHalfBtnPrimary]} onPress={handleAdd} disabled={creating}>
                                {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalHalfBtnTextPrimary}>Add Task</Text>}
                            </TouchableOpacity>
                        </View>

                        {showReminderPicker && (
                            <View style={styles.reminderCard}>
                                <View style={styles.reminderHeader}>
                                    <Text style={styles.reminderTitle}>Reminder time</Text>
                                    {reminderDate ? (
                                        <TouchableOpacity onPress={() => setReminderDate(null)}>
                                            <Text style={styles.clearReminderText}>Clear</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                                <Text style={styles.reminderSubtitle}>
                                    If you don't choose a reminder time, no notification will be created.
                                </Text>

                                {Platform.OS === 'ios' ? (
                                    <View style={styles.inlinePickerWrapper}>
                                        <DateTimePicker
                                            value={reminderDate || new Date()}
                                            mode="datetime"
                                            display="spinner"
                                            onChange={(e, d) => d && setReminderDate(d)}
                                            locale="he"
                                        />
                                    </View>
                                ) : (
                                    <View style={styles.androidPickerContainer}>
                                        <TouchableOpacity
                                            style={styles.calendarPreview}
                                            onPress={() => {
                                                const base = reminderDate || new Date();
                                                openAndroidDate(setReminderDate, base);
                                            }}
                                        >
                                            <Text style={styles.pickerLabel}>🗓️ Select reminder date</Text>
                                            <Text style={styles.pickerValue}>{formatDisplayDate(reminderDate)}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.timePreview}
                                            onPress={() => {
                                                const base = reminderDate || new Date();
                                                openAndroidTime(setReminderDate, base);
                                            }}
                                        >
                                            <Text style={styles.pickerLabel}>⏰ Select reminder time</Text>
                                            <Text style={styles.pickerValue}>{formatDisplayDate(reminderDate)}</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        )}
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    addModalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
        paddingHorizontal: 16,
    },
    addModalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        width: '100%',
        maxHeight: '68%',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
        elevation: 8,
    },
    content: {
        padding: 18,
        paddingBottom: 20,
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
    cancelText: { color: 'blue', fontWeight: '700' },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        width: '100%',
    },
    taskInputModal: {
        flex: 1,
        height: 48,
        paddingHorizontal: 12,
        fontSize: 16,
        backgroundColor: '#f9fafb',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        textAlign: 'left',
        color: '#1f2937',
    },
    micBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        justifyContent: 'center',
        alignItems: 'center',
    },
    micBtnActive: {
        backgroundColor: '#fee2e2',
        borderColor: '#ef4444',
    },
    micBtnDisabled: {
        opacity: 0.5,
    },
    micBtnText: {
        fontSize: 20,
    },
    recordingStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
        borderRadius: 10,
        padding: 10,
        marginTop: 10,
        gap: 8,
    },
    redDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#ef4444',
    },
    recordingText: {
        color: '#b91c1c',
        fontSize: 14,
        fontWeight: '600',
    },
    transcribingStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#a7f3d0',
        borderRadius: 10,
        padding: 10,
        marginTop: 10,
        gap: 8,
    },
    transcribingText: {
        color: '#065f46',
        fontSize: 14,
        fontWeight: '600',
    },
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    modalHalfBtn: { flex: 1, minHeight: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6', paddingHorizontal: 10 },
    modalHalfBtnPrimary: { backgroundColor: '#2f855a' },
    reminderBtnActive: { backgroundColor: '#fdf4ff', borderWidth: 1, borderColor: '#d946ef' },
    modalHalfBtnText: { fontSize: 15, fontWeight: '700', color: '#374151', textAlign: 'center' },
    modalHalfBtnTextPrimary: { fontSize: 15, fontWeight: '700', color: '#fff', textAlign: 'center' },
    reminderBtnTextActive: { color: '#d946ef' },
    reminderCard: { backgroundColor: '#fafafa', borderRadius: 14, padding: 14, marginTop: 12, borderWidth: 1, borderColor: '#e5e7eb' },
    reminderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    reminderTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
    clearReminderText: { color: '#ef4444', fontWeight: '700' },
    reminderSubtitle: { fontSize: 12, color: '#6b7280', marginBottom: 10 },
    inlinePickerWrapper: { overflow: 'hidden', borderRadius: 12, backgroundColor: '#fff' },
    androidPickerContainer: { gap: 10 },
    calendarPreview: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 14, justifyContent: 'center', alignItems: 'center' },
    timePreview: { backgroundColor: '#f3f4f6', borderRadius: 12, padding: 14, justifyContent: 'center', alignItems: 'center' },
    pickerLabel: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
    pickerValue: { fontSize: 16, fontWeight: '800', color: '#111827', marginTop: 4, textAlign: 'center' },
});