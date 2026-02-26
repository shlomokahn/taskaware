import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Dimensions,
    ActivityIndicator
} from 'react-native';

const { width } = Dimensions.get('window');

export default function EditTask({ visible, task, onClose, onSave }) {
    const [title, setTitle] = useState('');
    const [saving, setSaving] = useState(false);

    // עדכון הכותרת כשהמשימה משתנה
    useEffect(() => {
        if (task) {
            setTitle(task.title || '');
        }
    }, [task]);

    const handleSave = async () => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            alert('כותרת לא יכולה להיות ריקה');
            return;
        }

        setSaving(true);
        try {
            // הוספת בדיקת תקינות לפני קריאה לפונקציה
            if (onSave && task && task._id) {
                await onSave(task._id, trimmedTitle);
                onClose();
            }
        } catch (err) {
            console.error("Save error:", err);
            alert('שגיאה בשמירה');
        } finally {
            setSaving(false);
        }
    };

    if (!task) return null;

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

                <View style={styles.modalView}>
                    <Text style={styles.modalTitle}>עריכת משימה ✏️</Text>
                    <View style={styles.divider} />

                    <Text style={styles.label}>כותרת:</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="הכנס כותרת חדשה"
                        placeholderTextColor="#9ca3af"
                        value={title}
                        onChangeText={setTitle}
                        multiline={true}
                        maxLength={200}
                    />

                    <Text style={styles.charCount}>{title.length}/200</Text>

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.btn, styles.btnCancel]}
                            onPress={onClose}
                            disabled={saving}
                        >
                            <Text style={styles.btnTextDark}>ביטול</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.btn, styles.btnSave]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.btnTextWhite}>שמור</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
    modalView: {
        width: width * 0.85,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 25,
        alignItems: 'center',
        elevation: 5,
    },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#1f2937' },
    divider: { height: 1, backgroundColor: '#e5e7eb', width: '100%', marginBottom: 20 },
    label: { fontSize: 16, fontWeight: '600', color: '#6b7280', marginBottom: 8, width: '100%', textAlign: 'right' },
    input: {
        width: '100%',
        minHeight: 80,
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        color: '#111827',
        textAlignVertical: 'top',
        backgroundColor: '#f9fafb'
    },
    charCount: { fontSize: 12, color: '#9ca3af', marginBottom: 20, width: '100%', textAlign: 'left' },
    actions: { width: '100%', flexDirection: 'row', gap: 12, justifyContent: 'center' },
    btn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minWidth: 100 },
    btnCancel: { backgroundColor: '#e5e7eb', borderWidth: 1, borderColor: '#d1d5db' },
    btnSave: { backgroundColor: '#10b981' },
    btnTextWhite: { fontSize: 16, fontWeight: '600', color: '#fff' },
    btnTextDark: { fontSize: 16, fontWeight: '600', color: '#1f2937' }
});