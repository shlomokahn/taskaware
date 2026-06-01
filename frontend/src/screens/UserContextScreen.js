import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl, Modal, TextInput, ScrollView } from 'react-native';

const EditContextModal = ({ visible, context, onClose, onSave, API_BASE }) => {
    const [value, setValue] = useState('');
    const [hours, setHours] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [selectedPlace, setSelectedPlace] = useState(null);

    useEffect(() => {
        if (visible && context) {
            setValue(context.value || '');
            setHours(context.metadata?.hours || '');
            setSuggestions([]);
            setSelectedPlace({
                value: context.value || '',
                coords_lat: context.coords_lat ?? null,
                coords_lng: context.coords_lng ?? null,
            });
        }
    }, [visible, context]);

    useEffect(() => {
        const query = value.trim();

        if (!visible || !API_BASE) {
            setSuggestions([]);
            return;
        }

        if (query.length < 3) {
            setSuggestions([]);
            return;
        }

        const timeoutId = setTimeout(async () => {
            try {
                setLoadingSuggestions(true);
                const res = await fetch(`${API_BASE}/api/google-places/autocomplete/?input=${encodeURIComponent(query)}`);
                const data = await res.json();
                setSuggestions(Array.isArray(data.predictions) ? data.predictions : []);
            } catch (error) {
                console.error('Autocomplete error:', error);
                setSuggestions([]);
            } finally {
                setLoadingSuggestions(false);
            }
        }, 350);

        return () => clearTimeout(timeoutId);
    }, [value, visible, API_BASE]);

    const handleSelectSuggestion = async (suggestion) => {
        if (!suggestion?.place_id || !API_BASE) return;

        setValue(suggestion.description || suggestion.main_text || '');
        setSuggestions([]);
        setLoadingSuggestions(true);

        try {
            const res = await fetch(`${API_BASE}/api/google-places/details/?place_id=${encodeURIComponent(suggestion.place_id)}`);
            const data = await res.json();
            setSelectedPlace({
                placeId: data.place_id || suggestion.place_id,
                value: data.formatted_address || suggestion.description || value,
                coords_lat: data.coords_lat,
                coords_lng: data.coords_lng,
                name: data.name,
            });
        } catch (error) {
            console.error('Place details error:', error);
            setSelectedPlace({
                placeId: suggestion.place_id,
                value: suggestion.description || value,
                coords_lat: null,
                coords_lng: null,
                name: suggestion.description || value,
            });
        } finally {
            setLoadingSuggestions(false);
        }
    };

    const canSave = useMemo(() => !!value.trim(), [value]);

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Edit Location</Text>
                    <Text style={styles.modalSubtitle}>Choose a precise place from Google Places.</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Address or location name"
                        value={value}
                        onChangeText={(text) => {
                            setValue(text);
                            setSelectedPlace(null);
                        }}
                        placeholderTextColor="#9ca3af"
                    />

                    {loadingSuggestions && (
                        <View style={styles.loadingRow}>
                            <ActivityIndicator size="small" color="#2f855a" />
                            <Text style={styles.loadingText}>Searching Google Places...</Text>
                        </View>
                    )}

                    {suggestions.length > 0 && (
                        <View style={styles.suggestionsBox}>
                            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled showsVerticalScrollIndicator={false}>
                                {suggestions.map((item) => (
                                    <TouchableOpacity
                                        key={item.place_id}
                                        style={styles.suggestionItem}
                                        onPress={() => handleSelectSuggestion(item)}
                                    >
                                        <Text style={styles.suggestionMain}>{item.main_text}</Text>
                                        {!!item.secondary_text && <Text style={styles.suggestionSub}>{item.secondary_text}</Text>}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {selectedPlace?.coords_lat != null && selectedPlace?.coords_lng != null && (
                        <View style={styles.selectedBox}>
                            <Text style={styles.selectedTitle}>Selected place</Text>
                            <Text style={styles.selectedText} numberOfLines={2}>{selectedPlace.value}</Text>
                            <Text style={styles.selectedCoords}>
                                📌 {parseFloat(selectedPlace.coords_lat).toFixed(6)}, {parseFloat(selectedPlace.coords_lng).toFixed(6)}
                            </Text>
                        </View>
                    )}

                    <TextInput
                        style={styles.input}
                        placeholder="Working hours (optional)"
                        value={hours}
                        onChangeText={setHours}
                        placeholderTextColor="#9ca3af"
                    />

                    <View style={styles.modalActions}>
                        <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
                            <Text style={styles.secondaryText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.primaryBtn, !canSave && styles.primaryBtnDisabled]}
                            onPress={() => onSave(value.trim(), hours.trim(), selectedPlace)}
                            disabled={!canSave}
                        >
                            <Text style={styles.primaryText}>Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

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
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>📍 My Locations</Text>
                <View style={{ width: 60 }} />
            </View>

            {contexts.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>📭</Text>
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
                                        activeOpacity={0.7}
                                        onPress={() => setEditingContext(item)}
                                    >
                                        <Text style={styles.editBtnText}>✏️</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.editBtn, styles.deleteBtnStyle]}
                                        activeOpacity={0.7}
                                        onPress={() => deleteContext(item.id)}
                                    >
                                        <Text style={styles.deleteBtnText}>🗑️</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {item.metadata && Object.keys(item.metadata).length > 0 && (
                                <View style={styles.metadata}>
                                    {item.metadata.hours && (
                                        <>
                                            <Text style={styles.metadataLabel}>⏰ Hours:</Text>
                                            <Text style={styles.metadataValue}>{item.metadata.hours}</Text>
                                        </>
                                    )}
                                </View>
                            )}

                            <View style={styles.footer}>
                                <Text style={styles.footerText}>Updated: {formatDate(item.last_updated)}</Text>
                                {item.coords_lat && item.coords_lng && (
                                    <Text style={styles.coordsText}>📌 {parseFloat(item.coords_lat).toFixed(4)}, {parseFloat(item.coords_lng).toFixed(4)}</Text>
                                )}
                            </View>
                        </View>
                    )}
                />
            )}

            {editingContext && (
                <EditContextModal
                    visible={!!editingContext}
                    context={editingContext}
                    API_BASE={API_BASE}
                    onClose={() => setEditingContext(null)}
                    onSave={async (value, hours, selectedPlace) => {
                        try {
                            const hasCoords = selectedPlace?.coords_lat != null && selectedPlace?.coords_lng != null;
                            const res = await fetch(`${API_BASE}/api/user-context/${editingContext.id}/`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                                body: JSON.stringify({
                                    value,
                                    coords_lat: hasCoords ? selectedPlace.coords_lat : editingContext.coords_lat,
                                    coords_lng: hasCoords ? selectedPlace.coords_lng : editingContext.coords_lng,
                                    metadata: hours ? { hours } : {},
                                    source: hasCoords ? 'google_places' : editingContext.source || 'user',
                                    confidence: 1.0,
                                })
                            });
                            if (res.ok) {
                                const updated = await res.json();
                                setContexts(prev => prev.map(c => c.id === updated.id ? updated : c));
                                setEditingContext(null);
                                Alert.alert('Success', 'Location updated');
                            }
                        } catch (error) {
                            Alert.alert('Error', 'Failed to update location');
                        }
                    }}
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 20,
        width: '100%',
        maxWidth: 420,
        maxHeight: '82%',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 6,
    },
    modalSubtitle: {
        fontSize: 13,
        color: '#6b7280',
        marginBottom: 16,
    },
    input: {
        height: 46,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        paddingHorizontal: 12,
        fontSize: 15,
        backgroundColor: '#f9fafb',
        marginBottom: 12,
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    loadingText: {
        fontSize: 12,
        color: '#6b7280',
        fontWeight: '600',
    },
    suggestionsBox: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 12,
        maxHeight: 180,
    },
    suggestionItem: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    suggestionMain: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    suggestionSub: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 2,
    },
    selectedBox: {
        backgroundColor: '#ecfdf5',
        borderColor: '#bbf7d0',
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
    },
    selectedTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#047857',
        marginBottom: 4,
    },
    selectedText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    selectedCoords: {
        marginTop: 6,
        fontSize: 12,
        color: '#047857',
        fontWeight: '600',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 8,
    },
    secondaryBtn: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        paddingVertical: 12,
        alignItems: 'center',
        backgroundColor: '#f9fafb',
    },
    secondaryText: {
        fontWeight: '700',
        color: '#6b7280',
    },
    primaryBtn: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
        backgroundColor: '#2f855a',
    },
    primaryBtnDisabled: {
        backgroundColor: '#a7f3d0',
    },
    primaryText: {
        fontWeight: '700',
        color: '#fff',
    },
});
