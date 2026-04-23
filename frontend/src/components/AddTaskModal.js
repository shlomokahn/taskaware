import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

export default function AddTaskModal({ visible, onClose, onAddTask, creating }) {
    const [title, setTitle] = useState('');
    const [dueDate, setDueDate] = useState(new Date());
    const [isSmartTask, setIsSmartTask] = useState(false);

    // Reset fields when the modal opens
    useEffect(() => {
        if (visible) {
            setTitle('');
            setDueDate(new Date());
            setIsSmartTask(false);
        }
    }, [visible]);

    const handleAdd = () => {
        onAddTask(title, dueDate, isSmartTask);
    };

    const formatDisplayDate = (date) => {
        if (!date) return 'Select Date';
        const d = new Date(date);
        return isNaN(d.getTime()) ? 'Invalid Date' : d.toLocaleString('en-US', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
        });
    };

    const openAndroidDate = () => {
        DateTimePickerAndroid.open({
            value: dueDate, mode: 'date', display: 'calendar',
            onChange: (event, selectedDate) => {
                if (event.type === 'set' && selectedDate) {
                    const d = new Date(dueDate);
                    d.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                    setDueDate(d);
                }
            },
        });
    };

    const openAndroidTime = () => {
        DateTimePickerAndroid.open({
            value: dueDate, mode: 'time', is24Hour: true, display: 'clock',
            onChange: (event, selectedTime) => {
                if (event.type === 'set' && selectedTime) {
                    const d = new Date(dueDate);
                    d.setHours(selectedTime.getHours(), selectedTime.getMinutes());
                    setDueDate(d);
                }
            },
        });
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.addModalOverlay}>
                <View style={styles.addModalContent}>
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
                            style={[styles.modalHalfBtn, isSmartTask && styles.smartBtnActive]}
                            onPress={() => setIsSmartTask(!isSmartTask)}
                        >
                            <Text style={[styles.modalHalfBtnText, isSmartTask && styles.smartBtnTextActive]}>✨ AI</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.modalHalfBtn, styles.modalHalfBtnPrimary]} onPress={handleAdd} disabled={creating}>
                            {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalHalfBtnTextPrimary}>Add Task</Text>}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.pickersArea}>
                        {Platform.OS === 'ios' ? (
                            <>
                                <View style={styles.inlinePickerWrapper}>
                                    <DateTimePicker
                                        value={dueDate}
                                        mode="date"
                                        display="compact"
                                        onChange={(e, d) => d && setDueDate(new Date(d.getFullYear(), d.getMonth(), d.getDate(), dueDate.getHours(), dueDate.getMinutes()))}
                                        style={styles.datePickerInline}
                                    />
                                </View>

                                <View style={styles.inlinePickerWrapper}>
                                    <DateTimePicker
                                        value={dueDate}
                                        mode="time"
                                        display="spinner"
                                        is24Hour={true}
                                        onChange={(e, d) => d && setDueDate(new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate(), d.getHours(), d.getMinutes()))}
                                        style={styles.timePickerInline}
                                    />
                                </View>
                            </>
                        ) : (
                            <View style={styles.androidPickerContainer}>
                                <TouchableOpacity style={styles.calendarPreview} onPress={openAndroidDate}>
                                    <Text style={styles.pickerLabel}>🗓️ Select Date</Text>
                                    <Text style={styles.pickerValue}>{formatDisplayDate(dueDate).split(',')[0]}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.timePreview} onPress={openAndroidTime}>
                                    <Text style={styles.pickerLabel}>⏰ Select Time</Text>
                                    <Text style={styles.pickerValue}>{formatDisplayDate(dueDate).split(', ')[1] || formatDisplayDate(dueDate)}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        <View style={{ height: 18 }} />
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    addModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
    addModalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 12, width: '92%', height: '70%', justifyContent: 'flex-start', overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: 18, fontWeight: '800' },
    cancelText: { color: 'blue', fontWeight: '700' },
    taskInputModal: { height: 40, maxHeight: 40, minHeight: 40, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16, textAlignVertical: 'center', backgroundColor: '#f9fafb', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', textAlign: 'left', color: '#1f2937' },
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 },
    modalHalfBtn: { flex: 1, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6' },
    modalHalfBtnPrimary: { backgroundColor: '#2f855a' },
    smartBtnActive: { backgroundColor: '#fdf4ff', borderWidth: 1, borderColor: '#d946ef' },
    modalHalfBtnText: { fontSize: 15, fontWeight: '700', color: '#374151' },
    modalHalfBtnTextPrimary: { fontSize: 15, fontWeight: '700', color: '#fff' },
    smartBtnTextActive: { color: '#d946ef' },
    pickersArea: { flex: 1, marginTop: 12 },
    inlinePickerWrapper: { overflow: 'hidden', borderRadius: 12, backgroundColor: '#fff', marginBottom: 8 },
    datePickerInline: { width: '100%', backgroundColor: '#fff' },
    timePickerInline: { width: '100%', backgroundColor: '#fff' },
    androidPickerContainer: { flex: 1, justifyContent: 'center', gap: 12 },
    calendarPreview: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    timePreview: { height: 80, backgroundColor: '#f3f4f6', borderRadius: 12, padding: 16, justifyContent: 'center', alignItems: 'center' },
    pickerLabel: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
    pickerValue: { fontSize: 18, fontWeight: '800', color: '#111827', marginTop: 6 },
});