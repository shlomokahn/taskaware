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
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

export default function AddTaskModal({ visible, onClose, onAddTask, creating }) {
    const [title, setTitle] = useState('');
    const [reminderDate, setReminderDate] = useState(null);
    const [showReminderPicker, setShowReminderPicker] = useState(false);

    useEffect(() => {
        if (visible) {
            setTitle('');
            setReminderDate(null);
            setShowReminderPicker(false);
        }
    }, [visible]);

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

                        <TextInput
                            style={styles.taskInputModal}
                            placeholder="What's your next task?"
                            value={title}
                            onChangeText={setTitle}
                            placeholderTextColor="#9ca3af"
                            autoFocus={true}
                            editable={!creating}
                            returnKeyType="done"
                            multiline={false}
                        />

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
    taskInputModal: {
        height: 42,
        maxHeight: 42,
        minHeight: 42,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 16,
        textAlignVertical: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        textAlign: 'left',
        color: '#1f2937',
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