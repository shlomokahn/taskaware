import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet, TextInput, ScrollView } from 'react-native';
import SwipeableRow from '../components/SwipeableRow';

export default function HomeScreen({ 
    tasks, 
    refreshing, 
    fetchTasks, 
    setSelectedTask, 
    formatDisplayDate,
    currentLocation,
    currentLocationName,
    token,
    API_BASE,
    onToggleTaskComplete,
    onDeleteTask,
    onSyncLocation,
    isLocationSyncing
}) {
    const [contexts, setContexts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [scrollEnabled, setScrollEnabled] = useState(true);
    const sortBy = 'smart';

    // Fetch contexts for location sorting on mount
    const fetchContexts = async () => {
        if (!token || !API_BASE) return;
        try {
            const res = await fetch(`${API_BASE}/api/user-context/`, {
                headers: { 'Authorization': `Token ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setContexts(data || []);
            }
        } catch (err) {
            console.error('Error fetching contexts:', err);
        }
    };

    useEffect(() => {
        fetchContexts();
    }, [token, API_BASE]);

    // Calculate distance to task's actual place of execution or context location
    const getDistanceToPlace = (task, userCoords) => {
        if (!userCoords) return Infinity;
        
        // 1. Distance to actual closest place resolved by server (closestPlaceCoords)
        if (task.closestPlaceCoords && task.closestPlaceCoords.lat != null && task.closestPlaceCoords.lng != null) {
            const lat1 = userCoords.latitude;
            const lon1 = userCoords.longitude;
            const lat2 = parseFloat(task.closestPlaceCoords.lat);
            const lon2 = parseFloat(task.closestPlaceCoords.lng);
            
            const R = 6371000; // meters
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = 
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        }
        
        // 2. Fallback: Distance to required context location coordinates
        if (task.requiredContext && contexts.length > 0) {
            const ctx = contexts.find(c => c.key === task.requiredContext);
            if (ctx && ctx.coords_lat != null && ctx.coords_lng != null) {
                const lat1 = userCoords.latitude;
                const lon1 = userCoords.longitude;
                const lat2 = parseFloat(ctx.coords_lat);
                const lon2 = parseFloat(ctx.coords_lng);
                
                const R = 6371000;
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;
                const a = 
                    Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                    Math.sin(dLon/2) * Math.sin(dLon/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                return R * c;
            }
        }
        
        return Infinity;
    };

    // Generate label for distance to target place or context
    const getDistanceLabel = (task, userCoords) => {
        const dist = getDistanceToPlace(task, userCoords);
        if (dist === Infinity) return '';
        
        if (task.closestPlaceName) {
            const placeTitle = task.closestPlaceName;
            if (dist >= 1000) {
                return `📍 ${placeTitle} (${(dist / 1000).toFixed(1)} km away)`;
            }
            return `📍 ${placeTitle} (${Math.round(dist)}m away)`;
        }
        
        if (task.requiredContext) {
            const contextEmojis = {
                'work': '💼',
                'home': '🏠',
                'school': '🎓',
                'gym': '🏋️'
            };
            const emoji = contextEmojis[task.requiredContext] || '📍';
            const contextCapitalized = task.requiredContext.charAt(0).toUpperCase() + task.requiredContext.slice(1);
            if (dist >= 1000) {
                return `${emoji} ${contextCapitalized} (${(dist / 1000).toFixed(1)} km away)`;
            }
            return `${emoji} ${contextCapitalized} (${Math.round(dist)}m away)`;
        }
        
        return '';
    };

    // Filter by search query
    const filteredTasks = tasks.filter(task => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        
        const titleMatch = task.title?.toLowerCase().includes(query);
        const locMatch = task.locationQuery?.toLowerCase().includes(query);
        const ctxMatch = task.requiredContext?.toLowerCase().includes(query);
        
        return titleMatch || locMatch || ctxMatch;
    });

    // Sort tasks
    const sortedTasks = [...filteredTasks].sort((a, b) => {
        // Completed tasks always go to the bottom
        if (a.isCompleted !== b.isCompleted) {
            return a.isCompleted ? 1 : -1;
        }
        
        if (sortBy === 'dueDate') {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        }
        
        if (sortBy === 'location' && currentLocation?.coords) {
            const distA = getDistanceToPlace(a, currentLocation.coords);
            const distB = getDistanceToPlace(b, currentLocation.coords);
            if (distA !== distB) {
                return distA - distB;
            }
        }
        
        // Default 'smart' sort: due date soonest first, then tasks with no due date
        if (!a.dueDate && b.dueDate) return 1;
        if (a.dueDate && !b.dueDate) return -1;
        if (a.dueDate && b.dueDate) {
            return new Date(a.dueDate) - new Date(b.dueDate);
        }
        
        // Fallback to creation date (newest first)
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB - dateA;
    });

    return (
        <View style={{ flex: 1 }}>
            <View style={styles.header}>
                <Text style={styles.brand}>TaskAware</Text>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search tasks..."
                    placeholderTextColor="#9ca3af"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                        <Text style={styles.clearBtnText}>✕</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Location Status & Sync Row */}
            <View style={styles.locationContainer}>
                <View style={styles.locationInfo}>
                    <Text style={styles.locationLabel}>Device Location</Text>
                    <Text style={styles.locationCoords}>
                        {currentLocationName || (currentLocation?.coords 
                            ? `${currentLocation.coords.latitude.toFixed(4)}, ${currentLocation.coords.longitude.toFixed(4)}`
                            : 'Acquiring location...')}
                    </Text>
                </View>
                <TouchableOpacity 
                    style={[styles.syncButton, isLocationSyncing && styles.syncButtonActive]} 
                    onPress={onSyncLocation}
                    disabled={isLocationSyncing}
                >
                    <Text style={styles.syncButtonText}>
                        {isLocationSyncing ? '🔄 Syncing...' : '🔄 Sync Now'}
                    </Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.listTitle}>My Tasks</Text>
            
            <FlatList
                scrollEnabled={scrollEnabled}
                data={sortedTasks}
                contentContainerStyle={{ paddingBottom: 150 }}
                keyExtractor={(item) => (item._id || item.id)?.toString()}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>
                            {searchQuery ? 'No matching tasks found' : 'No tasks at the moment. Enjoy! 🎉'}
                        </Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <SwipeableRow
                        taskId={item._id || item.id}
                        onSwipeRight={() => onToggleTaskComplete(item)}
                        onSwipeLeft={() => onDeleteTask(item._id || item.id, item.notificationId)}
                        onSwipeStart={() => setScrollEnabled(false)}
                        onSwipeRelease={() => setScrollEnabled(true)}
                    >
                        <TouchableOpacity
                            style={[styles.taskRow, item.isCompleted && styles.taskRowCompleted]}
                            onPress={() => setSelectedTask(item)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.taskContent}>
                                <Text style={[styles.taskTitle, item.isCompleted && styles.taskTitleCompleted]}>
                                    {item.title}
                                </Text>
                                <Text style={styles.taskDate}>⏰ {formatDisplayDate(item.dueDate)}</Text>
                                
                                {/* Proximity distance display */}
                                {currentLocation?.coords && getDistanceToPlace(item, currentLocation.coords) !== Infinity ? (
                                    <Text style={styles.distanceText}>
                                        {getDistanceLabel(item, currentLocation.coords)}
                                    </Text>
                                ) : item.locationQuery ? (
                                    <Text style={styles.taskLocation}>📍 Suggested: {item.locationQuery}</Text>
                                ) : null}
                            </View>
                            <View style={[styles.statusCircle, item.isCompleted && styles.statusCircleCompleted]}>
                                {item.isCompleted && <Text style={styles.checkMark}>✓</Text>}
                            </View>
                        </TouchableOpacity>
                    </SwipeableRow>
                )}
                refreshControl={
                    <RefreshControl 
                        refreshing={refreshing} 
                        onRefresh={async () => {
                            await fetchTasks();
                            await fetchContexts();
                        }} 
                    />
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 20, paddingTop: 10 },
    brand: { fontSize: 32, fontWeight: '900', color: '#111827' },
    
    // Search styles
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        marginHorizontal: 20,
        marginBottom: 12,
        paddingHorizontal: 12,
    },
    searchIcon: { fontSize: 16, marginRight: 8 },
    searchInput: {
        flex: 1,
        fontSize: 15,
        paddingVertical: 10,
        color: '#1f2937',
        textAlign: 'left',
    },
    clearBtn: { padding: 4 },
    clearBtnText: { fontSize: 12, color: '#9ca3af', fontWeight: 'bold' },

    // Location Sync styles
    locationContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginHorizontal: 20,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    locationInfo: {
        flex: 1,
    },
    locationLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    locationCoords: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1f2937',
        marginTop: 2,
    },
    syncButton: {
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#059669',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    syncButtonActive: {
        opacity: 0.7,
    },
    syncButtonText: {
        color: '#059669',
        fontSize: 13,
        fontWeight: '700',
    },

    listTitle: { fontSize: 20, fontWeight: '800', color: '#374151', textAlign: 'left', marginBottom: 15, paddingHorizontal: 20 },
    taskRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 18, borderRadius: 20, marginBottom: 12, marginHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    taskRowCompleted: { backgroundColor: '#f9fafb', opacity: 0.7 },
    taskContent: { flex: 1, paddingRight: 15 },
    taskTitle: { fontSize: 17, fontWeight: '700', color: '#1f2937', textAlign: 'left' },
    taskTitleCompleted: { textDecorationLine: 'line-through', color: '#9ca3af' },
    taskDate: { fontSize: 13, color: '#6b7280', textAlign: 'left' },
    taskLocation: { fontSize: 13, color: '#8b5cf6', textAlign: 'left', fontWeight: '600', marginTop: 4 },
    distanceText: { fontSize: 13, color: '#059669', textAlign: 'left', fontWeight: '700', marginTop: 4 },
    statusCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
    statusCircleCompleted: { backgroundColor: '#2f855a', borderColor: '#2f855a' },
    checkMark: { color: '#fff', fontSize: 16 },
    emptyState: { alignItems: 'center', marginTop: 40 },
    emptyStateText: { fontSize: 16, color: '#9ca3af' },
});