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
    if (!task) return null;

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                {/* לחיצה על הרקע הכהה תסגור את המודל */}
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

                <View style={styles.modalView}>
                    {/* כותרת וסטטוס */}
                    <Text style={styles.modalTitle}>{task.title}</Text>

                    <View style={styles.statusContainer}>
                        <Text style={styles.label}>סטטוס:</Text>
                        <Text style={[styles.statusValue, { color: task.isCompleted ? '#10b981' : '#f59e0b' }]}>
                            {task.isCompleted ? 'הושלם ✓' : 'ממתין לביצוע ⏳'}
                        </Text>
                    </View>

                    <Text style={styles.dateText}>
                        נוצר ב: {new Date(task.createdAt).toLocaleDateString('he-IL')} בשעה {new Date(task.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </Text>

                    <View style={styles.divider} />

                    {/* כפתורי פעולה */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.btn, styles.btnToggle, task.isCompleted ? styles.btnOutline : styles.btnFill]}
                            onPress={() => onToggle(task)}
                        >
                            <Text style={[styles.btnText, task.isCompleted ? styles.textDark : styles.textWhite]}>
                                {task.isCompleted ? 'סמן כלא בוצע' : 'סמן כבוצע'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.btn, styles.btnEdit]}
                            onPress={() => onEdit(task)}
                        >
                            <Text style={styles.btnTextWhite}>ערוך משימה ✏️</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.btn, styles.btnDelete]}
                            onPress={() => {
                                onDelete(task._id);
                                onClose();
                            }}
                        >
                            <Text style={styles.btnTextWhite}>מחק משימה 🗑️</Text>
                        </TouchableOpacity>
                        
                    </View>

                    {/* כפתור סגירה תחתון */}
                    <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                        <Text style={styles.closeText}>סגור</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        width: width * 0.85,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 25,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
        color: '#1f2937'
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 8
    },
    label: { fontSize: 16, color: '#6b7280' },
    statusValue: { fontSize: 16, fontWeight: '700' },
    dateText: { fontSize: 12, color: '#9ca3af', marginBottom: 20 },
    divider: {
        height: 1,
        backgroundColor: '#e5e7eb',
        width: '100%',
        marginBottom: 20
    },
    actions: {
        width: '100%',
        gap: 12,
        marginBottom: 20
    },
    btn: {
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
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