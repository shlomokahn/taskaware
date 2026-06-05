import React, { useEffect, useState } from 'react';
import { View, Text, Switch, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';

export default function NotificationSettingsScreen({ token, API_BASE, tasks, onUpdateTask, onClose }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Settings state
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [dndEnabled, setDndEnabled] = useState(false);
    const [dndStart, setDndStart] = useState('22:00');
    const [dndEnd, setDndEnd] = useState('07:00');
    const [notificationRadius, setNotificationRadius] = useState(300);
    const [mutedContexts, setMutedContexts] = useState([]);

    // Fetch settings on mount
    useEffect(() => {
        const fetchSettings = async () => {
            if (!token || !API_BASE) return;
            try {
                const res = await fetch(`${API_BASE}/api/profile/settings/`, {
                    headers: { 'Authorization': `Token ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setNotificationsEnabled(data.notificationsEnabled ?? true);
                    setDndEnabled(data.dndEnabled ?? false);
                    setDndStart(data.dndStart || '22:00');
                    setDndEnd(data.dndEnd || '07:00');
                    setNotificationRadius(data.notificationRadius || 300);
                    setMutedContexts(data.mutedContexts || []);
                }
            } catch (error) {
                console.error('Error fetching notification settings:', error);
                Alert.alert('Error', 'Failed to retrieve notification settings from server');
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [token, API_BASE]);

    // Save settings helper
    const saveSettings = async (updates) => {
        if (!token || !API_BASE) return;
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE}/api/profile/settings/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                },
                body: JSON.stringify(updates)
            });
            if (!res.ok) {
                Alert.alert('Error', 'Failed to save settings');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            Alert.alert('Error', 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    // Toggle mute contexts
    const handleToggleContextMute = (contextKey) => {
        let newList = [...mutedContexts];
        if (newList.includes(contextKey)) {
            newList = newList.filter(c => c !== contextKey);
        } else {
            newList.push(contextKey);
        }
        setMutedContexts(newList);
        saveSettings({ mutedContexts: newList });
    };

    // Validate and save DND hours
    const handleSaveDndHours = () => {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(dndStart) || !timeRegex.test(dndEnd)) {
            Alert.alert('Error', 'Please enter a valid time format (HH:MM)');
            return;
        }
        saveSettings({ dndStart, dndEnd });
    };

    // Filter muted tasks from local tasks list
    const mutedTasks = tasks.filter(t => t.isMuted);

    const getContextLabel = (key) => {
        const labels = {
            'work': 'Work 💼',
            'home': 'Home 🏠',
            'school': 'School 🎓',
            'gym': 'Gym 🏋️'
        };
        return labels[key] || key;
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#2f855a" style={{ marginTop: 40 }} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.backBtn}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>🔔 Notifications</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Global Notification Card */}
                <View style={styles.card}>
                    <View style={styles.row}>
                        <View style={styles.textWrap}>
                            <Text style={styles.cardTitle}>Push Notifications Active</Text>
                            <Text style={styles.cardSubtitle}>Receive reminders when you are close to task locations</Text>
                        </View>
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={(val) => {
                                setNotificationsEnabled(val);
                                saveSettings({ notificationsEnabled: val });
                            }}
                            thumbColor={notificationsEnabled ? '#2f855a' : '#cbd5e1'}
                            trackColor={{ true: '#a7f3d0', false: '#f1f5f9' }}
                        />
                    </View>
                </View>

                {notificationsEnabled && (
                    <>
                        {/* Do Not Disturb (DND) Card */}
                        <View style={styles.card}>
                            <View style={styles.row}>
                                <View style={styles.textWrap}>
                                    <Text style={styles.cardTitle}>Do Not Disturb (DND)</Text>
                                    <Text style={styles.cardSubtitle}>Mute notifications during scheduled hours</Text>
                                </View>
                                <Switch
                                    value={dndEnabled}
                                    onValueChange={(val) => {
                                        setDndEnabled(val);
                                        saveSettings({ dndEnabled: val });
                                    }}
                                    thumbColor={dndEnabled ? '#2f855a' : '#cbd5e1'}
                                    trackColor={{ true: '#a7f3d0', false: '#f1f5f9' }}
                                />
                            </View>

                            {dndEnabled && (
                                <View style={styles.dndSection}>
                                    <View style={styles.timeInputsRow}>
                                        <View style={styles.timeInputBox}>
                                            <Text style={styles.timeLabel}>Start Time:</Text>
                                            <TextInput
                                                style={styles.timeInput}
                                                value={dndStart}
                                                onChangeText={setDndStart}
                                                onBlur={handleSaveDndHours}
                                                placeholder="22:00"
                                                keyboardType="numbers-and-punctuation"
                                            />
                                        </View>
                                        <View style={styles.timeInputBox}>
                                            <Text style={styles.timeLabel}>End Time:</Text>
                                            <TextInput
                                                style={styles.timeInput}
                                                value={dndEnd}
                                                onChangeText={setDndEnd}
                                                onBlur={handleSaveDndHours}
                                                placeholder="07:00"
                                                keyboardType="numbers-and-punctuation"
                                            />
                                        </View>
                                    </View>
                                    <Text style={styles.infoText}>Tap outside the text box to save</Text>
                                </View>
                            )}
                        </View>

                        {/* Proximity Alert Radius Card */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Proximity Notification Radius</Text>
                            <Text style={styles.cardSubtitle}>Choose how close you need to be to trigger a reminder</Text>
                            
                            <View style={styles.chipsRow}>
                                {[100, 300, 500, 1000].map((radius) => (
                                    <TouchableOpacity
                                        key={radius}
                                        style={[
                                            styles.chip,
                                            notificationRadius === radius && styles.chipActive
                                        ]}
                                        onPress={() => {
                                            setNotificationRadius(radius);
                                            saveSettings({ notificationRadius: radius });
                                        }}
                                    >
                                        <Text style={[
                                            styles.chipText,
                                            notificationRadius === radius && styles.chipTextActive
                                        ]}>
                                            {radius >= 1000 ? '1 km' : `${radius} m`}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Muted Contexts Card */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Mute Notifications by Context</Text>
                            <Text style={styles.cardSubtitle}>Select locations where you do not want to receive reminders</Text>

                            <View style={styles.contextGrid}>
                                {['home', 'work', 'school', 'gym'].map((key) => {
                                    const isContextMuted = mutedContexts.includes(key);
                                    return (
                                        <TouchableOpacity
                                            key={key}
                                            style={[
                                                styles.contextItem,
                                                isContextMuted && styles.contextItemMuted
                                            ]}
                                            onPress={() => handleToggleContextMute(key)}
                                        >
                                            <Text style={styles.contextLabel}>{getContextLabel(key)}</Text>
                                            <Text style={[
                                                styles.contextStatus,
                                                isContextMuted && styles.contextStatusMuted
                                            ]}>
                                                {isContextMuted ? 'Muted' : 'Active'}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Muted Tasks Card */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Muted Tasks</Text>
                            <Text style={styles.cardSubtitle}>Individual tasks that you have manually muted</Text>

                            {mutedTasks.length === 0 ? (
                                <Text style={styles.emptyTasksText}>No muted tasks at the moment</Text>
                            ) : (
                                <View style={styles.mutedTasksList}>
                                    {mutedTasks.map((task) => (
                                        <View key={task._id || task.id} style={styles.mutedTaskRow}>
                                            <Text style={styles.mutedTaskTitle} numberOfLines={1}>{task.title}</Text>
                                            <TouchableOpacity
                                                style={styles.unmuteBtn}
                                                onPress={() => onUpdateTask(task._id || task.id, { isMuted: false })}
                                            >
                                                <Text style={styles.unmuteBtnText}>Unmute 🔊</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    </>
                )}
            </ScrollView>
            
            {saving && (
                <View style={styles.savingOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.savingText}>Saving settings...</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f4f6' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    backBtn: { paddingHorizontal: 10, paddingVertical: 5 },
    backText: { fontSize: 16, fontWeight: '700', color: '#2f855a' },
    title: { fontSize: 20, fontWeight: '800', color: '#111827' },
    scrollContent: { paddingHorizontal: 20, paddingVertical: 16, gap: 16, paddingBottom: 120 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 5,
        elevation: 2,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    textWrap: { flex: 1, paddingRight: 10, textAlign: 'left' },
    cardTitle: { fontSize: 16, fontWeight: '800', color: '#111827', textAlign: 'left' },
    cardSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 4, textAlign: 'left' },
    dndSection: {
        marginTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
        paddingTop: 15,
    },
    timeInputsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        gap: 15,
    },
    timeInputBox: {
        flex: 1,
        alignItems: 'flex-start',
    },
    timeLabel: { fontSize: 13, color: '#374151', fontWeight: '700', marginBottom: 6 },
    timeInput: {
        width: '100%',
        height: 40,
        backgroundColor: '#f9fafb',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        textAlign: 'center',
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    infoText: { fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 8 },
    chipsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 15,
        gap: 8,
    },
    chip: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    chipActive: {
        backgroundColor: '#ecfdf5',
        borderColor: '#059669',
    },
    chipText: { fontSize: 13, fontWeight: '700', color: '#4b5563' },
    chipTextActive: { color: '#059669' },
    contextGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 15,
    },
    contextItem: {
        width: '48%',
        backgroundColor: '#f0fdf4',
        borderColor: '#bbf7d0',
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
    },
    contextItemMuted: {
        backgroundColor: '#f3f4f6',
        borderColor: '#e5e7eb',
    },
    contextLabel: { fontSize: 14, fontWeight: '800', color: '#1f2937' },
    contextStatus: { fontSize: 11, color: '#059669', fontWeight: '600', marginTop: 4 },
    contextStatusMuted: { color: '#9ca3af' },
    emptyTasksText: { fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
    mutedTasksList: { marginTop: 12, gap: 10 },
    mutedTaskRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    mutedTaskTitle: { fontSize: 14, fontWeight: '700', color: '#374151', flex: 1, textAlign: 'left', paddingRight: 10 },
    unmuteBtn: {
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#bbf7d0',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    unmuteBtnText: { fontSize: 12, fontWeight: '700', color: '#059669' },
    savingOverlay: {
        position: 'absolute',
        bottom: 90,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.75)',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 30,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
    },
    savingText: { color: '#fff', fontSize: 13, fontWeight: '600' }
});
