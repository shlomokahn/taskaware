import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    I18nManager,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Force Left-to-Right (LTR) layout direction globally
try {
    I18nManager.allowRTL(false);
    I18nManager.forceRTL(false);
} catch (e) {
    console.warn('Error forcing LTR layout:', e);
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { useLocationSync } from './src/useLocationSync.js';

const BACKGROUND_LOCATION_TASK = 'background-location-task';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
        console.error('Background location task error:', error);
        return;
    }
    if (data) {
        const { locations } = data;
        const [location] = locations;
        if (location) {
            const { latitude, longitude } = location.coords;
            try {
                const savedToken = await AsyncStorage.getItem('userToken');
                if (savedToken) {
                    await fetch('https://taskaware-backend.onrender.com/api/location/', {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Token ${savedToken}`
                        },
                        body: JSON.stringify({
                            latitude,
                            longitude,
                        }),
                    });
                    console.log('Background location synced:', latitude, longitude);
                }
            } catch (err) {
                console.error('Error syncing background location:', err);
            }
        }
    }
});

import TaskDetailModal from './src/components/TaskDetailModal';
import EditTask from './src/EditTask';
import UpdateChecker from './src/components/UpdateChecker';
import ContextPromptModal from './src/components/ContextPromptModal';
import NotificationSettingsScreen from './src/screens/NotificationSettingsScreen';

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

function AppContent() {
    const insets = useSafeAreaInsets();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [activeTab, setActiveTab] = useState('home');
    const [showContextManager, setShowContextManager] = useState(false);
    const [showNotificationSettings, setShowNotificationSettings] = useState(false);

    const [creating, setCreating] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [editingTask, setEditingTask] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [pendingContexts, setPendingContexts] = useState([]);
    const [activeContext, setActiveContext] = useState(null);
    const [suggestedReminders, setSuggestedReminders] = useState([]);

    const [token, setToken] = useState(null);
    const [username, setUsername] = useState('');

    const { location, locationName, syncLocation, isSyncing } = useLocationSync(API_BASE, token);

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
                    } catch (error) {
                        console.error('Error getting or sending push token:', error);
                    }
                }
            }
        }
        setupPushNotifications();
    }, [token]);

    useEffect(() => {
        async function startBackgroundTracking() {
            if (!token) return;
            try {
                const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
                if (fgStatus !== 'granted') return;

                const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
                if (bgStatus !== 'granted') {
                    console.log('Background location permission not granted');
                    return;
                }

                const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
                if (!hasStarted) {
                    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
                        accuracy: Location.Accuracy.Balanced,
                        distanceInterval: 150,
                        deferredUpdatesInterval: 60000,
                        foregroundService: {
                            notificationTitle: "TaskAware Active",
                            notificationBody: "Monitoring context and places to remind you of tasks",
                            notificationColor: "#2f855a",
                        },
                        pausesUpdatesAutomatically: true,
                    });
                    console.log('Background location updates started');
                }
            } catch (err) {
                console.error('Error starting background tracking:', err);
            }
        }
        startBackgroundTracking();
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
                    title: 'Task Reminder! 🔔',
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
            console.error('Notification scheduling error:', e);
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
            let url = `${API_BASE}/api/tasks/`;
            if (location && location.coords) {
                const { latitude, longitude } = location.coords;
                url += `?latitude=${latitude}&longitude=${longitude}`;
            }
            const res = await fetch(url, { headers: { 'Authorization': `Token ${token}` } });
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
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token, location]);

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
            const tzOffset = -new Date().getTimezoneOffset();
            const diff = tzOffset >= 0 ? '+' : '-';
            const pad = (num) => String(num).padStart(2, '0');
            const localISOTime = new Date(Date.now() + tzOffset * 60000).toISOString().slice(0, -5) + diff + pad(Math.floor(Math.abs(tzOffset) / 60)) + ':' + pad(Math.abs(tzOffset) % 60);

            const payload = {
                title: taskTitle,
                deviceTime: localISOTime
            };
            if (location && location.coords) {
                payload.latitude = location.coords.latitude;
                payload.longitude = location.coords.longitude;
            }

            const res = await fetch(`${API_BASE}/api/ask-ai/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                body: JSON.stringify(payload),
            });
            if (!res.ok) return null;
            const data = await res.json();
            return data;
        } catch (error) {
            console.error('AI location fetch error:', error);
            return null;
        }
    };

    const handleCreateTask = async (titlePassed, reminderDatePassed) => {
        const titleTrimmed = titlePassed.trim();
        if (!titleTrimmed || !token) return;
        setCreating(true);
        try {
            const aiData = await fetchLocationFromAI(titleTrimmed);
            const tasksToCreate = (aiData && Array.isArray(aiData)) ? aiData : [{
                title: titleTrimmed,
                locationQuery: null,
                requiredContext: null,
                contextCondition: null,
                dueDate: reminderDatePassed ? reminderDatePassed.toISOString() : null,
                suggestedDueDate: null
            }];

            for (const item of tasksToCreate) {
                let activeReminderDate = reminderDatePassed;
                if (!activeReminderDate && item.dueDate) {
                    const parsedDate = new Date(item.dueDate);
                    if (!isNaN(parsedDate.getTime()) && parsedDate > new Date()) {
                        activeReminderDate = parsedDate;
                    }
                }

                const notifId = activeReminderDate ? await scheduleNotification(item.title, activeReminderDate) : null;
                const payload = {
                    title: item.title,
                    notificationId: notifId,
                    locationQuery: item.locationQuery || null,
                    requiredContext: item.requiredContext || null,
                    contextCondition: item.contextCondition || null,
                };
                if (activeReminderDate) {
                    payload.dueDate = activeReminderDate.toISOString();
                }
                const res = await fetch(`${API_BASE}/api/tasks/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error('Failed to save task');
                const created = await res.json();
                
                if (item.suggestedDueDate && !activeReminderDate) {
                    setSuggestedReminders(prev => [
                        ...prev,
                        {
                            taskId: created.id || created._id,
                            title: created.title,
                            requiredContext: created.requiredContext,
                            locationQuery: created.locationQuery,
                            suggestedDueDate: item.suggestedDueDate
                        }
                    ]);
                }
                
                setTasks(prev => [created, ...prev]);
                await inferTaskContext(created.title);
            }
            
            setShowAddModal(false);
        } catch (err) {
            Alert.alert('Error', 'Error saving the task');
            console.error(err);
        } finally {
            setCreating(false);
        }
    };

    const handleVoiceTaskCreated = async (createdTasksList) => {
        try {
            const list = Array.isArray(createdTasksList) ? createdTasksList : [createdTasksList];
            for (const createdTask of list) {
                let finalTask = createdTask;
                if (createdTask.dueDate) {
                    const triggerDate = new Date(createdTask.dueDate);
                    if (!isNaN(triggerDate.getTime()) && triggerDate > new Date()) {
                        const notifId = await scheduleNotification(createdTask.title, triggerDate);
                        if (notifId) {
                            const updated = await handleUpdateTask(createdTask._id || createdTask.id, {
                                notificationId: notifId
                            });
                            if (updated) {
                                finalTask = updated;
                            }
                        }
                    }
                } else if (createdTask.suggestedDueDate) {
                    setSuggestedReminders(prev => [
                        ...prev,
                        {
                            taskId: createdTask.id || createdTask._id,
                            title: createdTask.title,
                            requiredContext: createdTask.requiredContext,
                            locationQuery: createdTask.locationQuery,
                            suggestedDueDate: createdTask.suggestedDueDate
                        }
                    ]);
                }
                setTasks(prev => [finalTask, ...prev]);
                await inferTaskContext(finalTask.title);
            }
            setShowAddModal(false);
        } catch (error) {
            console.error('Error handling voice task completion:', error);
            if (createdTasksList) {
                const list = Array.isArray(createdTasksList) ? createdTasksList : [createdTasksList];
                setTasks(prev => [...list, ...prev]);
            }
            setShowAddModal(false);
        }
    };

    const handleApplySuggestedReminder = async (taskId, suggestedDate) => {
        try {
            const task = tasks.find(t => (t._id || t.id) === taskId);
            if (!task) return;
            const notifId = await scheduleNotification(task.title, new Date(suggestedDate));
            await handleUpdateTask(taskId, {
                dueDate: suggestedDate,
                notificationId: notifId
            });
            setSuggestedReminders(prev => prev.filter(s => s.taskId !== taskId));
            Alert.alert('Success', 'Reminder set based on your habit! ⏰');
        } catch (error) {
            console.error('Error applying suggestion:', error);
            Alert.alert('Error', 'Failed to set reminder.');
        }
    };

    const handleDismissSuggestedReminder = (taskId) => {
        setSuggestedReminders(prev => prev.filter(s => s.taskId !== taskId));
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
        } catch (err) {
            console.error(err);
        }
    };

    const handleToggleTaskComplete = async (task) => {
        try {
            const newStatus = !task.isCompleted;
            if (newStatus && task.notificationId) {
                await cancelNotification(task.notificationId);
            }
            await handleUpdateTask(task._id || task.id, { isCompleted: newStatus });
        } catch (err) {
            console.error('Error toggling complete:', err);
        }
    };

    const handleDeleteTask = async (taskId, notificationId) => {
        try {
            if (notificationId) {
                await cancelNotification(notificationId);
            }
            await fetch(`${API_BASE}/api/tasks/${taskId}/`, {
                method: 'DELETE',
                headers: { 'Authorization': `Token ${token}` }
            });
            setTasks(prev => prev.filter(t => (t._id || t.id) !== taskId));
        } catch (err) {
            console.error('Error deleting task:', err);
        }
    };



    const formatDisplayDate = (date) => {
        if (!date) return 'No reminder';
        const d = new Date(date);
        return isNaN(d.getTime()) ? 'No reminder' : d.toLocaleString('en-US', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });
    };

    const handleLogout = async () => {
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('username');
        setToken(null);
        setActiveTab('home');
    };



    const saveUserContext = async (contextKey, value, hours, place) => {
        try {
            const formatCoords = (val) => {
                if (val == null) return null;
                const num = parseFloat(val);
                return isNaN(num) ? null : parseFloat(num.toFixed(6));
            };

            const hasCoords = place?.coords_lat != null && place?.coords_lng != null;
            const res = await fetch(`${API_BASE}/api/user-context/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                body: JSON.stringify({
                    key: contextKey,
                    value,
                    coords_lat: hasCoords ? formatCoords(place.coords_lat) : null,
                    coords_lng: hasCoords ? formatCoords(place.coords_lng) : null,
                    metadata: hours ? { hours } : null,
                    source: hasCoords ? 'google_places' : 'user',
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
            currentLocation={location}
            currentLocationName={locationName}
            token={token}
            API_BASE={API_BASE}
            onToggleTaskComplete={handleToggleTaskComplete}
            onDeleteTask={handleDeleteTask}
            onSyncLocation={syncLocation}
            isLocationSyncing={isSyncing}
            suggestedReminders={suggestedReminders}
            onApplySuggestedReminder={handleApplySuggestedReminder}
            onDismissSuggestedReminder={handleDismissSuggestedReminder}
        />
    );

    const renderSettingsScreen = () => {
        if (showContextManager) {
            return (
                <UserContextScreen
                    token={token}
                    API_BASE={API_BASE}
                    onClose={() => setShowContextManager(false)}
                />
            );
        }
        if (showNotificationSettings) {
            return (
                <NotificationSettingsScreen
                    token={token}
                    API_BASE={API_BASE}
                    tasks={tasks}
                    onUpdateTask={handleUpdateTask}
                    onClose={() => setShowNotificationSettings(false)}
                />
            );
        }
        return (
            <SettingsScreen
                username={username}
                setUsername={setUsername}
                handleLogout={handleLogout}
                onOpenContextManager={() => setShowContextManager(true)}
                onOpenNotificationSettings={() => setShowNotificationSettings(true)}
                token={token}
                API_BASE={API_BASE}
            />
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar style="dark" />
            <UpdateChecker API_BASE={API_BASE} />

            <View style={{ flex: 1 }}>
                {activeTab === 'home' ? renderHomeScreen() : renderSettingsScreen()}
            </View>

            <View style={[styles.bottomBar, { height: 60 + insets.bottom, paddingBottom: insets.bottom }]}>
                <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('home')}>
                    <Text style={[styles.tabIcon, activeTab === 'home' && styles.tabIconActive]}>🏠</Text>
                    <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>Home</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.addFloatingBtn} onPress={() => setShowAddModal(true)}>
                    <Text style={styles.addFloatingText}>＋</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('settings')}>
                    <Text style={[styles.tabIcon, activeTab === 'settings' && styles.tabIconActive]}>👤</Text>
                    <Text style={[styles.tabLabel, activeTab === 'settings' && styles.tabLabelActive]}>Profile</Text>
                </TouchableOpacity>
            </View>

            <TaskDetailModal
                visible={!!selectedTask}
                task={selectedTask}
                token={token}
                API_BASE={API_BASE}
                currentLocation={location}
                onClose={() => setSelectedTask(null)}
                onMuteToggle={async (task, newMuteValue) => {
                    await handleUpdateTask(task._id || task.id, { isMuted: newMuteValue });
                    setSelectedTask(prev => prev ? { ...prev, isMuted: newMuteValue } : null);
                }}
                onToggle={async (task) => {
                    await handleToggleTaskComplete(task);
                    setSelectedTask(null);
                }}
                onDelete={async (id) => {
                    await handleDeleteTask(id, selectedTask?.notificationId);
                    setSelectedTask(null);
                }}
                onEdit={(task) => { setEditingTask(task); setSelectedTask(null); }}
            />

            <EditTask
                visible={!!editingTask}
                task={editingTask}
                onClose={() => setEditingTask(null)}
                onSave={async (id, title, newReminderDate) => {
                    if (editingTask?.notificationId) {
                        await cancelNotification(editingTask.notificationId);
                    }
                    const newNotifId = newReminderDate ? await scheduleNotification(title, newReminderDate) : null;
                    await handleUpdateTask(id, {
                        title,
                        ...(newReminderDate ? { dueDate: newReminderDate } : { dueDate: null }),
                        ...(newNotifId ? { notificationId: newNotifId } : { notificationId: null }),
                    });
                    setEditingTask(null);
                }}
            />

            <AddTaskModal
                visible={showAddModal}
                onClose={() => setShowAddModal(false)}
                creating={creating}
                onAddTask={handleCreateTask}
                token={token}
                API_BASE={API_BASE}
                onVoiceTaskCreated={handleVoiceTaskCreated}
                currentLocation={location}
            />

            <ContextPromptModal
                visible={!!activeContext}
                contextLabel={activeContext?.label || activeContext?.key}
                contextKey={activeContext?.key}
                API_BASE={API_BASE}
                onSave={async (value, hours, place) => {
                    if (!activeContext) return;
                    await saveUserContext(activeContext.key, value, hours, place);
                    const nextQueue = pendingContexts.slice(1);
                    advanceContextPrompt(nextQueue);
                }}
                onSkip={() => {
                    const nextQueue = pendingContexts.slice(1);
                    advanceContextPrompt(nextQueue);
                }}
            />
        </View>
    );
}

export default function App() {
    return (
        <SafeAreaProvider>
            <AppContent />
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f4f6' },
    bottomBar: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        justifyContent: 'space-around',
        alignItems: 'center',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    tabItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
    tabIcon: { fontSize: 24, opacity: 0.4 },
    tabIconActive: { opacity: 1 },
    tabLabel: { fontSize: 12, fontWeight: 'bold', color: '#9ca3af', marginTop: 4 },
    tabLabelActive: { color: '#2f855a' },
    addFloatingBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2f855a', justifyContent: 'center', alignItems: 'center', marginTop: -28, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 6 },
    addFloatingText: { color: '#fff', fontSize: 30, lineHeight: 30, fontWeight: '900' },
});