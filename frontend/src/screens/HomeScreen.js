import React from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';

export default function HomeScreen({ tasks, refreshing, fetchTasks, setSelectedTask, formatDisplayDate }) {
    return (
        <View style={{ flex: 1 }}>
            <View style={styles.header}>
                <Text style={styles.brand}>TaskAware</Text>
            </View>

            <Text style={styles.listTitle}>My Tasks</Text>
            <FlatList
                data={tasks}
                contentContainerStyle={{ paddingBottom: 100 }}
                keyExtractor={(item) => (item._id || item.id)?.toString()}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>No tasks at the moment. Enjoy! 🎉</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[styles.taskRow, item.isCompleted && styles.taskRowCompleted]}
                        onPress={() => setSelectedTask(item)}
                    >
                        <View style={styles.taskContent}>
                            <Text style={[styles.taskTitle, item.isCompleted && styles.taskTitleCompleted]}>{item.title}</Text>
                            <Text style={styles.taskDate}>⏰ {formatDisplayDate(item.dueDate)}</Text>
                            {item.locationQuery && (
                                <Text style={styles.taskLocation}>📍 Suggested location: {item.locationQuery}</Text>
                            )}
                        </View>
                        <View style={[styles.statusCircle, item.isCompleted && styles.statusCircleCompleted]}>
                            {item.isCompleted && <Text style={styles.checkMark}>✓</Text>}
                        </View>
                    </TouchableOpacity>
                )}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchTasks} />}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, paddingHorizontal: 20, paddingTop: 10 },
    brand: { fontSize: 32, fontWeight: '900', color: '#111827' },
    listTitle: { fontSize: 20, fontWeight: '800', color: '#374151', textAlign: 'left', marginBottom: 15, paddingHorizontal: 20 },
    taskRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 18, borderRadius: 20, marginBottom: 12, marginHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    taskRowCompleted: { backgroundColor: '#f9fafb', opacity: 0.7 },
    taskContent: { flex: 1, paddingRight: 15 },
    taskTitle: { fontSize: 17, fontWeight: '700', color: '#1f2937', textAlign: 'left' },
    taskTitleCompleted: { textDecorationLine: 'line-through', color: '#9ca3af' },
    taskDate: { fontSize: 13, color: '#6b7280', textAlign: 'left' },
    taskLocation: { fontSize: 13, color: '#8b5cf6', textAlign: 'left', fontWeight: '600', marginTop: 4 },
    statusCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
    statusCircleCompleted: { backgroundColor: '#2f855a', borderColor: '#2f855a' },
    checkMark: { color: '#fff', fontSize: 16 },
    emptyState: { alignItems: 'center', marginTop: 40 },
    emptyStateText: { fontSize: 16, color: '#9ca3af' },
});