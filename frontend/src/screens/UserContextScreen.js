import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native';

export default function UserContextScreen({ token, API_BASE, onClose }) {
    const [contexts, setContexts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [editingContext, setEditingContext] = useState(null);

    const fetchContexts = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE}/api/user-context/`, {
                headers: { 'Authorization': `Token ${token}` }
            });
            if (!res.ok) {
                setContexts([]);
                return;
            }
            const data = await res.json();
            setContexts(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Fetch contexts error:', error);
            setContexts([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token, API_BASE]);

    useEffect(() => {
        fetchContexts();
    }, [fetchContexts]);

    const deleteContext = async (contextId) => {
        Alert.alert(
            'Delete Location',
            'Are you sure you want to delete this location?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const res = await fetch(`${API_BASE}/api/user-context/${contextId}/`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Token ${token}` }
                            });
                            if (res.ok) {
                                setContexts(prev => prev.filter(c => c.id !== contextId));
                                Alert.alert('Success', 'Location deleted');
                            }
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete location');
                        }
                    }
                }
            ]
        );
    };

    const getContextLabel = (key) => {
        const labels = {
            'work': 'Work',
            'home': 'Home',
            'school': 'School',
            'gym': 'Gym'
        };
        return labels[key] || key;
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const d = new Date(dateString);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
                    <Text style={styles.backText}>? Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>?? My Locations</Text>
                <View style={{ width: 60 }} />
            </View>

            {contexts.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>??</Text>
                    <Text style={styles.emptyText}>No locations saved yet</Text>
                    <Text style={styles.emptySubText}>Locations will be added when you create tasks</Text>
                </View>
            ) : (
                <FlatList
                    data={contexts}
                    keyExtractor={(item) => item.id?.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchContexts(); }} />}
                    renderItem={({ item }) => (
                        <View style={styles.contextCard}>
                            <View style={styles.cardHeader}>
                                <View style={styles.cardTitle}>
                                    <Text style={styles.contextKey}>{getContextLabel(item.key)}</Text>
                                    <Text style={styles.contextValue}>{item.value}</Text>
                                </View>
                                <View style={styles.cardActions}>
                                    <TouchableOpacity
                                        style={styles.editBtn}
                                        onPress={() => setEditingContext(item)}
                                    >
                                        <Text style={styles.editBtnText}>??</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.editBtn, styles.deleteBtnStyle]}
                                        onPress={() => deleteContext(item.id)}
                                    >
                                        <Text style={styles.deleteBtnText}>???</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {item.metadata?.hours && (
                                <View style={styles.metadata}>
                                    <Text style={styles.metadataLabel}>? Hours:</Text>
                                    <Text style={styles.metadataValue}>{item.metadata.hours}</Text>
                                </View>
                            )}

                            <View style={styles.footer}>
                                <Text style={styles.footerText}>Updated: {formatDate(item.last_updated)}</Text>
                                {item.coords_lat && item.coords_lng && (
                                    <Text style={styles.coordsText}>?? {parseFloat(item.coords_lat).toFixed(4)}, {parseFloat(item.coords_lng).toFixed(4)}</Text>
                                )}
                            </View>
                        </View>
                    )}
                />
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
    title: { fontSize: 22, fontWeight: '800', color: '#111827' },
    listContent: { paddingHorizontal: 20, paddingVertical: 16 },
    contextCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    cardTitle: { flex: 1 },
    contextKey: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 4 },
    contextValue: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
    cardActions: { flexDirection: 'row', gap: 8 },
    editBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    editBtnText: { fontSize: 18 },
    deleteBtnStyle: { backgroundColor: '#fef2f2', borderColor: '#fee2e2' },
    deleteBtnText: { fontSize: 18 },
    metadata: {
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        padding: 10,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    metadataLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
    metadataValue: { fontSize: 12, fontWeight: '600', color: '#111827' },
    footer: {
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        paddingTop: 10,
    },
    footerText: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
    coordsText: { fontSize: 11, color: '#8b5cf6', marginTop: 4 },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    emptyIcon: { fontSize: 64, marginBottom: 16 },
    emptyText: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
    emptySubText: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
});
