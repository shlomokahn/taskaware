import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useLocationSync } from './src/useLocationSync.js';

import TaskDetailModal from './src/components/TaskDetailModal';
import EditTask from './src/EditTask';
import UpdateChecker from './src/components/UpdateChecker';
import ContextPromptModal from './src/components/ContextPromptModal';

import * as Device from 'expo-device';
import Constants from 'expo-constants';

import LoginScreen from './src/screens/LoginScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import HomeScreen from './src/screens/HomeScreen';
import UserContextScreen from './src/screens/UserContextScreen';
import AddTaskModal from './src/components/AddTaskModal';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

const API_BASE = 'https://taskaware-backend.onrender.com';

export default function App() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [activeTab, setActiveTab] = useState('home');
    const [showContextManager, setShowContextManager] = useState(false);

    // States for components (Add Modal handled inside)
    const [creating, setCreating] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [editingTask, setEditingTask] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [pendingContexts, setPendingContexts] = useState([]);
    const [activeContext, setActiveContext] = useState(null);

    const [token, setToken] = useState(null);
    const [username, setUsername] = useState('');

    // Auth syncing
    const { location, syncLocation, isSyncing } = useLocationSync(API_BASE, token);

    useEffect(() => {
        Notifications.cancelAllScheduledNotificationsAsync();
        async function setupPushNotifications() {
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'Task Reminders',
                    importance: (Notifications.AndroidImportance && Notifications.AndroidImportance.HIGH) || 4,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            }

            if (Device.isDevice) {
                const { status: existingStatus } = await Notifications.getPermissionsAsync();
                let finalStatus = existingStatus;

                if (existingStatus !== 'granted') {
                    const { status } = await Notifications.requestPermissionsAsync();
                    finalStatus = status;
                }

                if (finalStatus !== 'granted') return;

                if (token) {
                    try {
                        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
                        const pushTokenString = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
                        await fetch(`${API_BASE}/api/save-push-token/`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                            body: JSON.stringify({ token: pushTokenString }),
                        });
                    } catch (error) { console.error("Error getting or sending push token:", error); }
                }
            }
        }
        setupPushNotifications();
    }, [token]);

    const scheduleNotification = async (taskTitle, date) => {
        const triggerDate = new Date(date);
        if (triggerDate <= new Date()) {
            console.warn('Notification date is in the past:', triggerDate);
            return null;
        }
        try {
            const notifId = await Notifications.scheduleNotificationAsync({
                content: {
                    title: "Task Reminder! 🔔",
                    body: taskTitle,
                    sound: true,
                    priority: (Notifications.AndroidPriority && Notifications.AndroidPriority.HIGH) || 1,
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: triggerDate,
                    channelId: 'default',
                },
            });
            console.log('Notification scheduled:', notifId);
            return notifId;
        } catch (e) {
            console.error("Notification scheduling error:", e);
            return null;
        }
    };

    const inferTaskContext = async (taskTitle) => {
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE}/api/tasks/infer-context/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                body: JSON.stringify({ title: taskTitle }),
            });
            if (!res.ok) return;
            const data = await res.json();
            const pending = Array.isArray(data.pending_contexts) ? data.pending_contexts : [];
            if (pending.length > 0) {
                setPendingContexts(pending);
                setActiveContext(pending[0]);
            }
        } catch (error) {
            console.error('Context inference error:', error);
        }
    };

    const cancelNotification = async (notifId) => {
        if (notifId) await Notifications.cancelScheduledNotificationAsync(notifId);
    };

    const fetchTasks = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE}/api/tasks/`, { headers: { 'Authorization': `Token ${token}` } });
            if (!res.ok) {
                console.error('Fetch tasks error:', res.status);
                setTasks([]);
                return;
            }
            const data = await res.json();
            setTasks(Array.isArray(data) ? data : []);
        } catch (err) { 
            console.error('Fetch error:', err);
            setTasks([]);
        }
        finally { setLoading(false); setRefreshing(false); }
    }, [token]);

    useEffect(() => {
        (async () => {
            const savedToken = await AsyncStorage.getItem('userToken');
            const savedUser = await AsyncStorage.getItem('username');
            if (savedToken) setToken(savedToken);
            if (savedUser) setUsername(savedUser);
            setLoading(false);
        })();
    }, []);

    useEffect(() => { if (token) fetchTasks(); }, [token, fetchTasks]);

    const fetchLocationFromAI = async (taskTitle) => {
        try {
            const res = await fetch(`${API_BASE}/api/ask-ai/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                body: JSON.stringify({ title: taskTitle }),
            });
            if (!res.ok) return null;
            const data = await res.json();
            return data.locationQuery || null;
        } catch (error) {
            console.error("AI location fetch error:", error);
            return null;
        }
    };

    const handleCreateTask = async (titlePassed, dueDatePassed, isSmartTaskPassed) => {
        const titleTrimmed = titlePassed.trim();
        if (!titleTrimmed || !token) return;
        if (dueDatePassed <= new Date()) {
            Alert.alert("Invalid Date", "Please select a date and time in the future.");
            return;
        }
        setCreating(true);
        try {
            let suggestedLocation = '';
            if (isSmartTaskPassed) {
                suggestedLocation = await fetchLocationFromAI(titleTrimmed);
            }
            const notifId = await scheduleNotification(titleTrimmed, dueDatePassed);
            const res = await fetch(`${API_BASE}/api/tasks/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                body: JSON.stringify({
                    title: titleTrimmed,
                    dueDate: dueDatePassed.toISOString(),
                    notificationId: notifId,
                    locationQuery: suggestedLocation
                }),
            });
            if (!res.ok) throw new Error("Failed to save task");
            const created = await res.json();
            setTasks(prev => [created, ...prev]);
            setShowAddModal(false);
            await inferTaskContext(titleTrimmed);
        } catch (err) {
            Alert.alert("Error", "Error saving the task");
            console.error(err);
        } finally {
            setCreating(false);
        }
    };

    const handleUpdateTask = async (taskId, fields) => {
        try {
            const res = await fetch(`${API_BASE}/api/tasks/${taskId}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                body: JSON.stringify(fields),
            });
            const updated = await res.json();
            setTasks(prev => prev.map(t => (t._id || t.id) === taskId ? updated : t));
            return updated;
        } catch (err) { console.error(err); }
    };

    const formatDisplayDate = (date) => {
        if (!date) return 'Select date';
        const d = new Date(date);
        return isNaN(d.getTime()) ? 'Invalid date' : d.toLocaleString('en-US', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });
    };

    const handleLogout = async () => {
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('username');
        setToken(null);
        setActiveTab('home');
    };

    const handleLocationSync = async () => {
        const result = await syncLocation();
        if (result.success) {
            Alert.alert('Success', 'Location synced successfully');
            return;
        }

        if (result.error === 'Permission denied') {
            Alert.alert('Permission Required', 'To sync location you need to grant location permission');
            return;
        }

        Alert.alert('Error', 'Location sync failed, please try again');
    };

    const saveUserContext = async (contextKey, value, hours) => {
        try {
            const res = await fetch(`${API_BASE}/api/user-context/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                body: JSON.stringify({
                    key: contextKey,
                    value,
                    metadata: hours ? { hours } : null,
                    source: 'user',
                    confidence: 1.0,
                }),
            });
            if (!res.ok) {
                console.warn('Failed saving context:', res.status);
            }
        } catch (error) {
            console.error('Context save error:', error);
        }
    };

    const advanceContextPrompt = (nextQueue) => {
        if (nextQueue.length === 0) {
            setPendingContexts([]);
            setActiveContext(null);
            return;
        }
        setPendingContexts(nextQueue);
        setActiveContext(nextQueue[0]);
    };

    if (!token) {
        return (
            <LoginScreen
                API_BASE={API_BASE}
                setToken={setToken}
                setUsername={setUsername}
            />
        );
    }

    const renderHomeScreen = () => (
        <HomeScreen
            tasks={tasks}
            refreshing={refreshing}
            fetchTasks={fetchTasks}
            setSelectedTask={setSelectedTask}
            formatDisplayDate={formatDisplayDate}
        />
    );

    const renderSettingsScreen = () => (
        showContextManager ? (
            <UserContextScreen
                token={token}
                API_BASE={API_BASE}
                onClose={() => setShowContextManager(false)}
            />
        ) : (
            <SettingsScreen
                username={username}
                handleLogout={handleLogout}
                handleLocationSync={handleLocationSync}
                isSyncing={isSyncing}
                onOpenContextManager={() => setShowContextManager(true)}
            />
        )
    );

    return (
        <SafeAreaView style={styles.container}>
            <UpdateChecker API_BASE={API_BASE} />

            {activeTab === 'home' ? renderHomeScreen() : renderSettingsScreen()}

            {/* Bottom Tab Bar */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={styles.tabItem}
                    onPress={() => setActiveTab('home')}
                >
                    <Text style={[styles.tabIcon, activeTab === 'home' && styles.tabIconActive]}>🏠</Text>
                    <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>Home</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.addFloatingBtn} onPress={() => setShowAddModal(true)}>
                    <Text style={styles.addFloatingText}>＋</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.tabItem}
                    onPress={() => setActiveTab('settings')}
                >
                    <Text style={[styles.tabIcon, activeTab === 'settings' && styles.tabIconActive]}>👤</Text>
                    <Text style={[styles.tabLabel, activeTab === 'settings' && styles.tabLabelActive]}>Profile</Text>
                </TouchableOpacity>
            </View>

            {/* Modals */}
            <TaskDetailModal
                visible={!!selectedTask}
                task={selectedTask}
                onClose={() => setSelectedTask(null)}
                onToggle={async (task) => {
                    const newStatus = !task.isCompleted;
                    if (newStatus) await cancelNotification(task.notificationId);
                    await handleUpdateTask(task._id || task.id, { isCompleted: newStatus });
                    setSelectedTask(null);
                }}
                onDelete={async (id) => {
                    if (selectedTask?.notificationId) await cancelNotification(selectedTask.notificationId);
                    await fetch(`${API_BASE}/api/tasks/${id}/`, { method: 'DELETE', headers: { 'Authorization': `Token ${token}` } });
                    setTasks(prev => prev.filter(t => (t._id || t.id) !== id));
                    setSelectedTask(null);
                }}
                onEdit={(task) => { setEditingTask(task); setSelectedTask(null); }}
            />

            <EditTask
                visible={!!editingTask}
                task={editingTask}
                onClose={() => setEditingTask(null)}
                onSave={async (id, title, newDueDate) => {
                    if (newDueDate && editingTask?.notificationId) {
                        await cancelNotification(editingTask.notificationId);
                    }
                    const newNotifId = newDueDate ? await scheduleNotification(title, newDueDate) : editingTask?.notificationId;
                    await handleUpdateTask(id, {
                        title,
                        ...(newDueDate && { dueDate: newDueDate }),
                        ...(newNotifId && { notificationId: newNotifId }),
                    });
                    setEditingTask(null);
                }}
            />

            {/* Add Task Modal Integration */}
            <AddTaskModal
                visible={showAddModal}
                onClose={() => setShowAddModal(false)}
                creating={creating}
                onAddTask={handleCreateTask}
            />

            <ContextPromptModal
                visible={!!activeContext}
                contextLabel={activeContext?.label || activeContext?.key}
                onSave={async (value, hours) => {
                    if (!activeContext) return;
                    await saveUserContext(activeContext.key, value, hours);
                    const nextQueue = pendingContexts.slice(1);
                    advanceContextPrompt(nextQueue);
                }}
                onSkip={() => {
                    const nextQueue = pendingContexts.slice(1);
                    advanceContextPrompt(nextQueue);
                }}
            />

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f4f6' },
    bottomBar: {
        flexDirection: 'row',
        height: 80,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        paddingBottom: 20,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        justifyContent: 'space-around',
        alignItems: 'center',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 10
    },
    tabItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
    tabIcon: { fontSize: 24, opacity: 0.4 },
    tabIconActive: { opacity: 1 },
    tabLabel: { fontSize: 12, fontWeight: 'bold', color: '#9ca3af', marginTop: 4 },
    tabLabelActive: { color: '#2f855a' },
    addFloatingBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2f855a', justifyContent: 'center', alignItems: 'center', marginTop: -28, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 6 },
    addFloatingText: { color: '#fff', fontSize: 30, lineHeight: 30, fontWeight: '900' },
});