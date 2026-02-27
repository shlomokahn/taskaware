import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function TaskDetailModal({ visible, task, onClose, onToggle, onDelete, onEdit }) {
    if (!task) return null;

    // פונקציה לעיצוב התאריך לתצוגה נוחה
    const formatDate = (dateString) => {
        if (!dateString) return 'ללא תאריך';
        const d = new Date(dateString);
        return isNaN(d.getTime()) ? 'תאריך לא תקין' : d.toLocaleString('he-IL', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.card}>

                    {/* כותרת המשימה */}
                    <Text style={[styles.title, task.isCompleted && styles.completedText]}>
                        {task.title}
                    </Text>

                    {/* אזור פרטי המשימה (תאריך וסטטוס) */}
                    <View style={styles.detailsContainer}>
                        <Text style={styles.detailText}>⏰ מועד: {formatDate(task.dueDate)}</Text>
                        <Text style={styles.detailText}>
                            📌 סטטוס: <Text style={{ color: task.isCompleted ? '#2f855a' : '#d97706', fontWeight: 'bold' }}>
                                {task.isCompleted ? 'הושלם' : 'בתהליך'}
                            </Text>
                        </Text>
                    </View>

                    {/* אזור הכפתורים */}
                    <View style={styles.actionsContainer}>

                        {/* כפתור שינוי סטטוס גדול */}
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: task.isCompleted ? '#f59e0b' : '#2f855a' }]}
                            onPress={() => onToggle(task)}
                        >
                            <Text style={styles.btnText}>{task.isCompleted ? 'סמן כלא הושלם' : 'סמן כהושלם ✓'}</Text>
                        </TouchableOpacity>

                        {/* שורת כפתורים: ערוך ומחק */}
                        <View style={styles.rowButtons}>
                            <TouchableOpacity style={[styles.halfBtn, { backgroundColor: '#3b82f6' }]} onPress={() => onEdit(task)}>
                                <Text style={styles.btnText}>✏️ ערוך</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.halfBtn, { backgroundColor: '#ef4444' }]} onPress={() => onDelete(task._id)}>
                                <Text style={styles.btnText}>🗑️ מחק</Text>
                            </TouchableOpacity>
                        </View>

                        {/* כפתור סגירה סולידי */}
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <Text style={styles.closeBtnText}>סגור</Text>
                        </TouchableOpacity>

                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)', // רקע חצי שקוף וכהה
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    card: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 24, // פינות עגולות ומודרניות
        padding: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
        elevation: 10 // צל לאנדרואיד
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
        color: '#1f2937',
        textAlign: 'right', // יישור לימין לעברית
        marginBottom: 15
    },
    completedText: {
        textDecorationLine: 'line-through',
        color: '#9ca3af'
    },
    detailsContainer: {
        backgroundColor: '#f3f4f6', // רקע אפור בהיר לפרטים
        padding: 15,
        borderRadius: 12,
        marginBottom: 25
    },
    detailText: {
        fontSize: 16,
        color: '#4b5563',
        textAlign: 'right',
        marginBottom: 8,
        fontWeight: '500'
    },
    actionsContainer: {
        gap: 12 // רווח שווה בין כל הכפתורים
    },
    actionBtn: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2
    },
    rowButtons: {
        flexDirection: 'row-reverse', // מסדר את הכפתורים מימין לשמאל
        justifyContent: 'space-between',
        gap: 12
    },
    halfBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2
    },
    btnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold'
    },
    closeBtn: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#e5e7eb', // אפור סולידי
        marginTop: 5
    },
    closeBtnText: {
        color: '#4b5563',
        fontSize: 16,
        fontWeight: 'bold'
    }
});