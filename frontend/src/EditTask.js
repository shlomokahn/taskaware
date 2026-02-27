import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform
} from 'react-native';

export default function EditTask({ visible, task, onClose, onSave }) {
    const [title, setTitle] = useState('');

    // מעדכן את השדה ברגע שפותחים את המודל עם משימה ספציפית
    useEffect(() => {
        if (task) {
            setTitle(task.title);
        }
    }, [task]);

    if (!task) return null;

    const handleSave = () => {
        if (title.trim()) {
            onSave(task._id, title.trim());
        }
    };

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            {/* KeyboardAvoidingView מוודא שהמקלדת לא תסתיר את המודל */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <View style={styles.card}>
                    <Text style={styles.headerTitle}>עריכת משימה</Text>

                    <TextInput
                        style={styles.input}
                        value={title}
                        onChangeText={setTitle}
                        placeholder="שם המשימה..."
                        autoFocus // מקפיץ את המקלדת אוטומטית
                        selectionColor="#2f855a"
                    />

                    <View style={styles.buttonRow}>
                        {/* כפתור שמירה - מודגש וירוק */}
                        <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleSave}>
                            <Text style={styles.saveBtnText}>שמור שינויים</Text>
                        </TouchableOpacity>

                        {/* כפתור ביטול - אפור וסולידי */}
                        <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onClose}>
                            <Text style={styles.cancelBtnText}>ביטול</Text>
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
        backgroundColor: 'rgba(0,0,0,0.5)', // רקע חצי שקוף
        justifyContent: 'center',
        paddingHorizontal: 20
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 24, // פינות מודרניות כמו בשאר האפליקציה
        padding: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
        elevation: 10
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1f2937',
        textAlign: 'right', // יישור לימין לעברית
        marginBottom: 20
    },
    input: {
        height: 55,
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        textAlign: 'right',
        fontSize: 16,
        marginBottom: 25,
        color: '#111827'
    },
    buttonRow: {
        flexDirection: 'row-reverse', // מסדר את הכפתורים: "שמור" בימין, "ביטול" בשמאל
        gap: 12
    },
    btn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    saveBtn: {
        backgroundColor: '#2f855a',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2
    },
    saveBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold'
    },
    cancelBtn: {
        backgroundColor: '#f3f4f6'
    },
    cancelBtnText: {
        color: '#4b5563',
        fontSize: 16,
        fontWeight: 'bold'
    }
});