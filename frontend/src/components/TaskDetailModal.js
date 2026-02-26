import React from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions
} from 'react-native';

const { width } = Dimensions.get('window');

export default function TaskDetailModal({ visible, task, onClose, onToggle, onDelete, onEdit }) {
    // מניעת רינדור אם אין משימה
    if (!task) return null;

    // פונקציית עזר פנימית להצגת תאריך ללא קריסה (מונע את המסך הלבן)
    const safeFormatDate = (dateString) => {
        if (!dateString) return "לא צוין";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "תאריך לא תקין";

        return `${date.toLocaleDateString('he-IL')} בשעה ${date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
    };

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
                    <Text style={styles.modalTitle}>{task.title || "משימה ללא כותרת"}</Text>

                    <View style={styles.statusContainer}>
                        <Text style={styles.label}>סטטוס:</Text>
                        <Text style={[styles.statusValue, { color: task.isCompleted ? '#10b981' : '#f59e0b' }]}>
                            {task.isCompleted ? 'הושלם ✓' : 'ממתין לביצוע ⏳'}
                        </Text>
                    </View>

                    <Text style={styles.dateText}>
                        נוצר ב: {safeFormatDate(task.createdAt)}
                    </Text>

                    <View style={styles.divider} />

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.btn, styles.btnToggle, task.isCompleted ? styles.btnOutline : styles.btnFill]}
                            onPress={() => onToggle && onToggle(task)}
                        >
                            <Text style={[styles.btnText, task.isCompleted ? styles.textDark : styles.textWhite]}>
                                {task.isCompleted ? 'סמן כלא בוצע' : 'סמן כבוצע'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.btn, styles.btnEdit]}
                            onPress={() => onEdit && onEdit(task)}
                        >
                            <Text style={styles.btnTextWhite}>ערוך משימה ✏️</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.btn, styles.btnDelete]}
                            onPress={() => {
                                if (onDelete) {
                                    onDelete(task._id);
                                    onClose();
                                }
                            }}
                        >
                            <Text style={styles.btnTextWhite}>מחק משימה 🗑️</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                        <Text style={styles.closeText}>סגור</Text>
                    </TouchableOpacity>
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
    statusContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
    label: { fontSize: 16, color: '#6b7280' },
    statusValue: { fontSize: 16, fontWeight: '700' },
    dateText: { fontSize: 12, color: '#9ca3af', marginBottom: 20 },
    divider: { height: 1, backgroundColor: '#e5e7eb', width: '100%', marginBottom: 20 },
    actions: { width: '100%', gap: 12, marginBottom: 20 },
    btn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    btnToggle: { borderColor: '#10b981', borderWidth: 1 },
    btnFill: { backgroundColor: '#10b981' },
    btnOutline: { backgroundColor: 'transparent' },
    btnDelete: { backgroundColor: '#ef4444' },
    btnEdit: { backgroundColor: '#3b82f6' },
    btnText: { fontSize: 16, fontWeight: '600' },
    btnTextWhite: { fontSize: 16, fontWeight: '600', color: '#fff' },
    textWhite: { color: '#fff' },
    textDark: { color: '#1f2937' },
    closeBtn: { padding: 10 },
    closeText: { color: '#6b7280', fontSize: 16 }
});