import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native';

export default function TaskDetailModal({ visible, task, onClose, onToggle, onDelete, onEdit }) {
    if (!task) return null;

    const formatDate = (dateString) => {
        if (!dateString) return null;
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return null;
        const day = d.toLocaleDateString('he-IL', { day: '2-digit', month: 'short' });
        const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        return { day, time };
    };

    const dateInfo = formatDate(task.dueDate);

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

                <View style={styles.sheet}>
                    <View style={styles.handle} />
                    <View style={[styles.statusStrip, task.isCompleted ? styles.stripDone : styles.stripPending]} />

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

                        {/* כותרת וסטטוס */}
                        <View style={styles.titleRow}>
                            <Text style={[styles.title, task.isCompleted && styles.titleDone]} numberOfLines={3}>
                                {task.title}
                            </Text>
                            <View style={[styles.statusPill, task.isCompleted ? styles.pillDone : styles.pillPending]}>
                                <Text style={[styles.statusPillText, task.isCompleted ? styles.pillTextDone : styles.pillTextPending]}>
                                    {task.isCompleted ? 'הושלם ✓' : 'בתהליך'}
                                </Text>
                            </View>
                        </View>

                        {/* תאריך — לחיצה פותחת עריכה מלאה */}
                        {dateInfo ? (
                            <TouchableOpacity style={styles.dateChip} onPress={() => onEdit(task)} activeOpacity={0.7}>
                                <Text style={styles.dateChipIcon}>📅</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.dateChipDay}>{dateInfo.day}</Text>
                                    <Text style={styles.dateChipTime}>{dateInfo.time}</Text>
                                </View>
                                <Text style={styles.dateChipEdit}>עריכה ›</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={styles.dateChipEmpty} onPress={() => onEdit(task)}>
                                <Text style={styles.dateChipEmptyText}>+ הוסף תאריך</Text>
                            </TouchableOpacity>
                        )}

                        {/* כרטיס המלצת AI — מוצג רק כשיש locationQuery */}
                        {task.locationQuery ? (
                            <View style={styles.aiCard}>
                                <View style={styles.aiCardHeader}>
                                    <Text style={styles.aiCardIcon}>✨</Text>
                                    <Text style={styles.aiCardLabel}>המלצת AI</Text>
                                </View>
                                <View style={styles.locationRow}>
                                    <Text style={styles.locationPin}>📍</Text>
                                    <Text style={styles.locationText}>{task.locationQuery}</Text>
                                </View>

                                <View style={styles.mapBox}>
                                    <View style={styles.mapDot} />
                                    <Text style={styles.mapLabel}>{task.locationQuery}</Text>
                                </View>

                                <TouchableOpacity style={styles.navBtn} activeOpacity={0.75}>
                                    <Text style={styles.navBtnText}>🧭  נווט לשם</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}

                        {/* פעולות */}
                        <View style={styles.iconRow}>
                            <TouchableOpacity style={styles.iconTile} onPress={() => onEdit(task)}>
                                <Text style={styles.iconTileEmoji}>✏️</Text>
                                <Text style={styles.iconTileLabel}>עריכה</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.iconTile, styles.iconTileDestructive]}
                                onPress={() => onDelete(task._id || task.id)}>
                                <Text style={styles.iconTileEmoji}>🗑️</Text>
                                <Text style={[styles.iconTileLabel, styles.iconTileLabelDestructive]}>מחיקה</Text>
                            </TouchableOpacity>
                        </View>

                        {/* כפתור ראשי */}
                        <TouchableOpacity
                            style={[styles.cta, task.isCompleted ? styles.ctaUndo : styles.ctaDo]}
                            onPress={() => onToggle(task)}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.ctaText, task.isCompleted ? styles.ctaTextUndo : styles.ctaTextDo]}>
                                {task.isCompleted ? '↩  החזר לרשימה' : '✓  סמן כבוצע'}
                            </Text>
                        </TouchableOpacity>

                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const PURPLE = '#7C3AED';
const GREEN = '#059669';

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
        backgroundColor: '#FAFAFA',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: 'hidden',
        maxHeight: '88%',
    },
    handle: {
        width: 36,
        height: 4,
        backgroundColor: '#D1D5DB',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 4,
    },
    statusStrip: {
        height: 3,
        marginHorizontal: 20,
        borderRadius: 2,
        marginBottom: 8,
    },
    stripPending: { backgroundColor: '#FCD34D' },
    stripDone: { backgroundColor: '#6EE7B7' },

    content: {
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    },

    titleRow: {
        flexDirection: 'row-reverse',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 14,
        marginTop: 4,
    },
    title: {
        flex: 1,
        fontSize: 22,
        fontWeight: '800',
        color: '#111827',
        textAlign: 'right',
        lineHeight: 30,
    },
    titleDone: {
        textDecorationLine: 'line-through',
        color: '#9CA3AF',
    },
    statusPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        alignSelf: 'flex-start',
        marginTop: 4,
    },
    pillPending: { backgroundColor: '#FEF3C7' },
    pillDone: { backgroundColor: '#D1FAE5' },
    statusPillText: { fontSize: 12, fontWeight: '700' },
    pillTextPending: { color: '#92400E' },
    pillTextDone: { color: '#065F46' },

    dateChip: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    dateChipIcon: { fontSize: 22 },
    dateChipDay: { fontSize: 14, fontWeight: '700', color: '#1F2937', textAlign: 'right' },
    dateChipTime: { fontSize: 13, color: '#6B7280', textAlign: 'right' },
    dateChipEdit: { fontSize: 12, color: '#6B7280' },
    dateChipEmpty: {
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 14,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
    },
    dateChipEmptyText: { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },

    aiCard: {
        backgroundColor: '#F5F3FF',
        borderRadius: 18,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#DDD6FE',
    },
    aiCardHeader: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
    },
    aiCardIcon: { fontSize: 16 },
    aiCardLabel: {
        fontSize: 13,
        fontWeight: '800',
        color: PURPLE,
        letterSpacing: 0.5,
    },
    locationRow: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    locationPin: { fontSize: 20 },
    locationText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
        textAlign: 'right',
        flex: 1,
    },
    mapBox: {
        height: 100,
        backgroundColor: '#EDE9FE',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        gap: 6,
    },
    mapDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: PURPLE,
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: PURPLE,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
        elevation: 4,
    },
    mapLabel: { fontSize: 12, color: PURPLE, fontWeight: '600' },
    navBtn: {
        backgroundColor: PURPLE,
        borderRadius: 12,
        paddingVertical: 11,
        alignItems: 'center',
    },
    navBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

    iconRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    iconTile: {
        flex: 1,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingVertical: 13,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    iconTileDestructive: { borderColor: '#FEE2E2', backgroundColor: '#FFF5F5' },
    iconTileEmoji: { fontSize: 20 },
    iconTileLabel: { fontSize: 14, fontWeight: '700', color: '#374151' },
    iconTileLabelDestructive: { color: '#EF4444' },

    cta: {
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
    },
    ctaDo: { backgroundColor: GREEN },
    ctaUndo: { backgroundColor: '#F3F4F6' },
    ctaText: { fontSize: 16, fontWeight: '800' },
    ctaTextDo: { color: '#fff' },
    ctaTextUndo: { color: '#6B7280' },
});