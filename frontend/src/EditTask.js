import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Alert
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function EditTask({ visible, task, onClose, onSave }) {
    const insets = useSafeAreaInsets();
    const [title, setTitle] = useState('');
    const [reminderDate, setReminderDate] = useState(null);
    const [showIOSPicker, setShowIOSPicker] = useState(false);

    useEffect(() => {
        if (task) {
            setTitle(task.title);
            setReminderDate(task.dueDate ? new Date(task.dueDate) : null);
            setShowIOSPicker(false);
        }
    }, [task]);

    if (!task) return null;

    const formatDate = (date) => {
        if (!date) return 'No reminder';
        const d = new Date(date);
        return isNaN(d.getTime()) ? 'No reminder' : d.toLocaleString('en-US', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const openAndroidPicker = () => {
        const baseDate = reminderDate || new Date();
        DateTimePickerAndroid.open({
            value: baseDate,
            mode: 'date',
            display: 'calendar',
            onChange: (event, selectedDate) => {
                if (event.type === 'set' && selectedDate) {
                    DateTimePickerAndroid.open({
                        value: selectedDate,
                        mode: 'time',
                        is24Hour: true,
                        display: 'clock',
                        onChange: (timeEvent, finalDate) => {
                            if (timeEvent.type === 'set' && finalDate) {
                                setReminderDate(finalDate);
                            }
                        },
                    });
                }
            },
        });
    };

    const handlePickReminder = () => {
        if (Platform.OS === 'android') {
            openAndroidPicker();
        } else {
            setShowIOSPicker(true);
        }
    };

    const handleSave = () => {
        const trimmed = title.trim();
        if (!trimmed) return;

        if (reminderDate && reminderDate <= new Date()) {
            Alert.alert('Invalid reminder', 'Please select a future reminder time');
            return;
        }

        onSave(task._id || task.id, trimmed, reminderDate ? reminderDate.toISOString() : null);
    };

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <View style={[styles.card, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
                    <Text style={styles.headerTitle}>Edit task</Text>

                    <Text style={styles.label}>task name</Text>
                    <TextInput
                        style={styles.input}
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Task name..."
                        autoFocus
                        selectionColor="#2f855a"
                    />

                    <Text style={styles.label}>Reminder</Text>
                    <TouchableOpacity style={styles.dateTile} onPress={handlePickReminder} activeOpacity={0.7}>
                        <Text style={styles.dateTileIcon}>⏰</Text>
                        <Text style={styles.dateTileText}>{formatDate(reminderDate)}</Text>
                        <Text style={styles.dateTileChevron}>›</Text>
                    </TouchableOpacity>

                    <View style={styles.reminderActions}>
                        <TouchableOpacity
                            style={styles.clearBtn}
                            onPress={() => setReminderDate(null)}
                            disabled={!reminderDate}
                        >
                            <Text style={[styles.clearBtnText, !reminderDate && styles.disabledText]}>Remove reminder</Text>
                        </TouchableOpacity>
                    </View>

                    {Platform.OS === 'ios' && showIOSPicker && (
                        <View style={styles.iosPickerWrap}>
                            <DateTimePicker
                                value={reminderDate || new Date()}
                                mode="datetime"
                                display="spinner"
                                onChange={(e, d) => d && setReminderDate(d)}
                                locale="he"
                            />
                            <TouchableOpacity
                                style={styles.iosDoneBtn}
                                onPress={() => setShowIOSPicker(false)}
                            >
                                <Text style={styles.iosDoneBtnText}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={styles.buttonRow}>
                        <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onClose}>
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleSave}>
                            <Text style={styles.saveBtnText}>Save changes</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
        elevation: 10,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1f2937',
        textAlign: 'left',
        marginBottom: 20,
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
        color: '#6B7280',
        textAlign: 'left',
        marginBottom: 6,
    },
    input: {
        height: 55,
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        textAlign: 'left',
        fontSize: 16,
        marginBottom: 18,
        color: '#111827',
    },
    dateTile: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        paddingHorizontal: 14,
        height: 55,
        marginBottom: 10,
        gap: 10,
    },
    dateTileIcon: { fontSize: 20 },
    dateTileText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        textAlign: 'left',
    },
    dateTileChevron: {
        fontSize: 20,
        color: '#9CA3AF',
        marginLeft: 4,
    },
    reminderActions: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        marginBottom: 18,
    },
    clearBtn: {
        paddingVertical: 6,
        paddingHorizontal: 2,
    },
    clearBtnText: {
        color: '#ef4444',
        fontWeight: '700',
    },
    disabledText: {
        color: '#9ca3af',
    },
    iosPickerWrap: {
        backgroundColor: '#f9fafb',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    iosDoneBtn: {
        alignItems: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    iosDoneBtnText: {
        color: '#2f855a',
        fontWeight: '700',
        fontSize: 15,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    btn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveBtn: {
        backgroundColor: '#2f855a',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    cancelBtn: { backgroundColor: '#f3f4f6' },
    cancelBtnText: { color: '#4b5563', fontSize: 16, fontWeight: 'bold' },
});