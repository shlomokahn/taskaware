import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';

export default function TaskDetailModal({ visible, task, onClose, onToggle, onDelete, onEdit, onEditDate }) {
    if (!task) return null;

    // עיצוב תאריך מקוצר ונוח לתגית (למשל: 17:25, 27.02)
    const formatCompactDate = (dateString) => {
        if (!dateString) return 'ללא תאריך';
        const d = new Date(dateString);
        return isNaN(d.getTime()) ? 'תאריך שגוי' : d.toLocaleString('he-IL', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                {/* לחיצה מחוץ לכרטיסייה תסגור אותה */}
                <TouchableOpacity style={styles.backgroundDismiss} onPress={onClose} activeOpacity={1} />

                <View style={styles.bottomSheet}>
                    {/* פס קטן למעלה שמרמז שזו מגירה נגררת */}
                    <View style={styles.dragHandle} />

                    {/* --- שורת כותרת ואייקונים --- */}
                    <View style={styles.headerRow}>
                        <Text style={[styles.title, task.isCompleted && styles.completedText]}>
                            {task.title}
                        </Text>
                        <View style={styles.iconActions}>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => onEdit(task)}>
                                <Text style={styles.iconText}>✏️</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => onDelete(task._id || task.id)}>
                                <Text style={styles.iconText}>🗑️</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* --- שורת תגיות (סטטוס וזמן) --- */}
                    <View style={styles.badgesRow}>
                        {/* תגית סטטוס */}
                        <View style={[styles.badge, { backgroundColor: task.isCompleted ? '#dcfce7' : '#fef3c7' }]}>
                            <Text style={[styles.badgeText, { color: task.isCompleted ? '#166534' : '#b45309' }]}>
                                {task.isCompleted ? '✓ הושלם' : '📌 בתהליך'}
                            </Text>
                        </View>

                        {/* תגית תאריך (לחיצה פותחת עריכת זמן) */}
                        <TouchableOpacity style={styles.dateBadge} onPress={() => onEditDate && onEditDate(task)}>
                            <Text style={styles.dateBadgeText}>⏰ {formatCompactDate(task.dueDate)} ▾</Text>
                        </TouchableOpacity>
                    </View>

                    {/* --- אזור ה-AI והמפה (Geofencing Placeholder) --- */}
                    {task.locationQuery ? (
                        <View style={styles.aiSection}>
                            <Text style={styles.aiTitle}>✨ המלצת ה-AI</Text>
                            <Text style={styles.aiText}>כדי להשלים משימה זו, מומלץ לבקר ב: <Text style={styles.aiHighlight}>{task.locationQuery}</Text></Text>

                            {/* שומר המקום למפה */}
                            <View style={styles.mapPlaceholder}>
                                <Text style={styles.mapText}>[ 🗺️ מפה מקומית עם סיכות תופיע כאן ]</Text>
                                <Text style={styles.mapSubText}>מחפש '{task.locationQuery}' באזורך...</Text>
                            </View>

                            <TouchableOpacity style={styles.navBtn}>
                                <Text style={styles.navBtnText}>📍 הצג עסקים קרובים ברשימה</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    {/* --- פעולת הליבה (CTA) --- */}
                    <View style={styles.bottomActions}>
                        <TouchableOpacity
                            style={[styles.mainCtaBtn, { backgroundColor: task.isCompleted ? '#f3f4f6' : '#2f855a' }]}
                            onPress={() => onToggle(task)}
                        >
                            <Text style={[styles.mainCtaText, { color: task.isCompleted ? '#4b5563' : '#fff' }]}>
                                {task.isCompleted ? '↩️ סמן כלא הושלם (החזר לביצוע)' : '✓ סמן משימה כהושלמה'}
                            </Text>
                        </TouchableOpacity>

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
        backgroundColor: 'rgba(0,0,0,0.5)', // רקע חצי שקוף
        justifyContent: 'flex-end', // מצמיד את התוכן לתחתית
    },
    backgroundDismiss: {
        flex: 1, // תופס את כל החלל הריק למעלה כדי לאפשר סגירה בלחיצה בחוץ
    },
    bottomSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingHorizontal: 25,
        paddingTop: 15,
        paddingBottom: Platform.OS === 'ios' ? 40 : 25, // ריווח בתחתית בהתאם למכשיר
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 20,
    },
    dragHandle: {
        width: 50,
        height: 5,
        backgroundColor: '#e5e7eb',
        borderRadius: 5,
        alignSelf: 'center',
        marginBottom: 20,
    },
    headerRow: {
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 15,
    },
    title: {
        flex: 1,
        fontSize: 26,
        fontWeight: '900',
        color: '#1f2937',
        textAlign: 'right',
        marginLeft: 15, // רווח מהכפתורים
    },
    completedText: {
        textDecorationLine: 'line-through',
        color: '#9ca3af',
    },
    iconActions: {
        flexDirection: 'row-reverse',
        gap: 10,
    },
    iconBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconText: {
        fontSize: 18,
    },
    badgesRow: {
        flexDirection: 'row-reverse',
        gap: 10,
        marginBottom: 25,
    },
    badge: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
    },
    badgeText: {
        fontSize: 14,
        fontWeight: '700',
    },
    dateBadge: {
        backgroundColor: '#f3f4f6',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    dateBadgeText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4b5563',
    },
    aiSection: {
        backgroundColor: '#fdf4ff', // סגול-ורוד בהיר מאוד
        borderRadius: 20,
        padding: 20,
        marginBottom: 25,
        borderWidth: 1,
        borderColor: '#f5d0fe',
    },
    aiTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#a21caf',
        textAlign: 'right',
        marginBottom: 5,
    },
    aiText: {
        fontSize: 15,
        color: '#4b5563',
        textAlign: 'right',
        marginBottom: 15,
    },
    aiHighlight: {
        fontWeight: 'bold',
        color: '#86198f',
    },
    mapPlaceholder: {
        height: 120,
        backgroundColor: '#f3f4f6',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderStyle: 'dashed',
        marginBottom: 15,
    },
    mapText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#9ca3af',
    },
    mapSubText: {
        fontSize: 13,
        color: '#9ca3af',
        marginTop: 5,
    },
    navBtn: {
        backgroundColor: '#fff',
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    navBtnText: {
        color: '#4b5563',
        fontWeight: 'bold',
        fontSize: 14,
    },
    bottomActions: {
        marginTop: 10,
    },
    mainCtaBtn: {
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 5,
        elevation: 4,
        marginBottom: 12,
    },
    mainCtaText: {
        fontSize: 18,
        fontWeight: '900',
    },
    closeBtn: {
        paddingVertical: 15,
        alignItems: 'center',
    },
    closeBtnText: {
        color: '#6b7280',
        fontSize: 16,
        fontWeight: '600',
    },
});