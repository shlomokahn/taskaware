import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';

export default function ContextPromptModal({ visible, contextLabel, contextKey, onSave, onSkip, API_BASE }) {
    const [value, setValue] = useState('');
    const [hours, setHours] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [selectedPlace, setSelectedPlace] = useState(null);
    const [nearbySuggestions, setNearbySuggestions] = useState([]);
    const [loadingNearby, setLoadingNearby] = useState(false);

    useEffect(() => {
        if (visible) {
            setValue('');
            setHours('');
            setSuggestions([]);
            setSelectedPlace(null);
            setLoadingSuggestions(false);
            setNearbySuggestions([]);
            setLoadingNearby(false);
        }
    }, [visible]);

    // Fetch nearby suggestions for location category keys (except work/home)
    useEffect(() => {
        if (!visible || !contextKey || !API_BASE) {
            setNearbySuggestions([]);
            return;
        }

        const personalKeys = ['work', 'home'];
        if (personalKeys.includes(contextKey.toLowerCase())) {
            setNearbySuggestions([]);
            return;
        }

        const fetchNearby = async () => {
            try {
                setLoadingNearby(true);
                let loc = null;
                try {
                    loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                } catch (locErr) {
                    console.log('Error getting position in modal:', locErr);
                }

                if (!loc) {
                    loc = await Location.getLastKnownPositionAsync({});
                }

                if (loc && loc.coords) {
                    const res = await fetch(`${API_BASE}/api/google-places/nearby-suggestions/`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            latitude: loc.coords.latitude,
                            longitude: loc.coords.longitude,
                            category: contextKey,
                        }),
                    });

                    if (res.ok) {
                        const data = await res.json();
                        setNearbySuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
                    }
                }
            } catch (err) {
                console.error('Error fetching nearby suggestions:', err);
                setNearbySuggestions([]);
            } finally {
                setLoadingNearby(false);
            }
        };

        fetchNearby();
    }, [visible, contextKey, API_BASE]);

    // Autocomplete searching for address input
    useEffect(() => {
        const query = value.trim();

        if (!visible || !API_BASE) {
            setSuggestions([]);
            return;
        }

        if (query.length < 3) {
            setSuggestions([]);
            setSelectedPlace(null);
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
        if (!suggestion?.place_id || !API_BASE) {
            return;
        }

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
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onSkip}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
                <View style={styles.card}>
                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <Text style={styles.title}>Quick question</Text>
                        <Text style={styles.subtitle}>Where is your {contextLabel}?</Text>

                        {loadingNearby && (
                            <View style={styles.loadingNearbyRow}>
                                <ActivityIndicator size="small" color="#2f855a" />
                                <Text style={styles.loadingText}>Finding nearby {contextLabel}s...</Text>
                            </View>
                        )}

                        {nearbySuggestions.length > 0 && (
                            <View style={styles.nearbyContainer}>
                                <Text style={styles.nearbyTitle}>Nearby options (tap to select):</Text>
                                {nearbySuggestions.map((item, index) => (
                                    <TouchableOpacity
                                        key={item.place_id || index}
                                        style={styles.nearbyItem}
                                        onPress={() => {
                                            const valueToSave = `${item.name}, ${item.formatted_address}`;
                                            const placeObj = {
                                                placeId: item.place_id,
                                                value: item.formatted_address,
                                                coords_lat: item.coords_lat,
                                                coords_lng: item.coords_lng,
                                                name: item.name,
                                            };
                                            onSave(valueToSave, hours, placeObj);
                                        }}
                                    >
                                        <Text style={styles.nearbyItemName}>📍 {item.name}</Text>
                                        <Text style={styles.nearbyItemAddress}>{item.formatted_address} ({item.distance_m}m away)</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        <TextInput
                            style={styles.input}
                            placeholder="Or search another address"
                            value={value}
                            onChangeText={(text) => {
                                setValue(text);
                                setSelectedPlace(null);
                            }}
                            autoFocus={nearbySuggestions.length === 0 && !loadingNearby}
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
                                {suggestions.map((item) => (
                                    <TouchableOpacity key={item.place_id} style={styles.suggestionItem} onPress={() => handleSelectSuggestion(item)}>
                                        <Text style={styles.suggestionMain}>{item.main_text}</Text>
                                        {!!item.secondary_text && <Text style={styles.suggestionSub}>{item.secondary_text}</Text>}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {selectedPlace?.coords_lat && selectedPlace?.coords_lng ? (
                            <View style={styles.selectedBox}>
                                <Text style={styles.selectedTitle}>Selected place</Text>
                                <Text style={styles.selectedText} numberOfLines={2}>{selectedPlace.value}</Text>
                                <Text style={styles.selectedCoords}>
                                    📌 {parseFloat(selectedPlace.coords_lat).toFixed(6)}, {parseFloat(selectedPlace.coords_lng).toFixed(6)}
                                </Text>
                            </View>
                        ) : null}

                        <TextInput
                            style={styles.input}
                            placeholder="Working hours (optional)"
                            value={hours}
                            onChangeText={setHours}
                            placeholderTextColor="#9ca3af"
                        />

                        <View style={styles.actions}>
                            <TouchableOpacity style={styles.secondaryBtn} onPress={onSkip}>
                                <Text style={styles.secondaryText}>Not now</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.primaryBtn, !canSave && styles.primaryBtnDisabled]}
                                onPress={() => onSave(value.trim(), hours.trim(), selectedPlace)}
                                disabled={!canSave}
                            >
                                <Text style={styles.primaryText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 20,
        width: '100%',
        maxWidth: 420,
        maxHeight: '82%',
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
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
    actions: {
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
    nearbyContainer: {
        marginBottom: 16,
    },
    nearbyTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    nearbyItem: {
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    nearbyItemName: {
        fontSize: 14,
        fontWeight: '800',
        color: '#1f2937',
    },
    nearbyItemAddress: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 2,
    },
    loadingNearbyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
});

