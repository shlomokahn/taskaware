import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native';

export default function TaskDetailModal({ visible, task, onClose, onToggle, onDelete, onEdit, token, API_BASE, currentLocation }) {
    const [nearbyPlaces, setNearbyPlaces] = useState([]);
    const [mapImageUrl, setMapImageUrl] = useState(null);
    const [nearbyLoading, setNearbyLoading] = useState(false);
    const [nearbyError, setNearbyError] = useState('');
    const [searchInfo, setSearchInfo] = useState(null);
    const lastSearchKeyRef = useRef('');
    const activeRequestRef = useRef(0);

    const taskId = task?._id || task?.id;

    const formatDate = (dateString) => {
        if (!dateString) return null;
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return null;
        const day = d.toLocaleDateString('he-IL', { day: '2-digit', month: 'short' });
        const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        return { day, time };
    };

    const formatDistance = (meters) => {
        if (meters == null) return '';
        if (meters >= 1000) {
            return `${(meters / 1000).toFixed(1)} km`;
        }
        return `${meters} m`;
    };

    const openPlace = async (place) => {
        if (!place?.directions_url && !place?.maps_url) return;
        try {
            await Linking.openURL(place.directions_url || place.maps_url);
        } catch (error) {
            console.error('Failed to open place URL:', error);
        }
    };

    useEffect(() => {
        const loadNearbyPlaces = async () => {
            if (!visible || !taskId || !API_BASE || !token) {
                return;
            }

            const latitude = currentLocation?.coords?.latitude;
            const longitude = currentLocation?.coords?.longitude;
            const searchKey = `${taskId}:${latitude ?? 'saved'}:${longitude ?? 'saved'}`;

            if (lastSearchKeyRef.current === searchKey) {
                return;
            }

            lastSearchKeyRef.current = searchKey;
            const requestId = ++activeRequestRef.current;

            setNearbyLoading(true);
            setNearbyError('');
            setNearbyPlaces([]);
            setMapImageUrl(null);
            setSearchInfo(null);

            try {
                const payload = {};
                if (latitude != null && longitude != null) {
                    payload.latitude = latitude;
                    payload.longitude = longitude;
                }

                const res = await fetch(`${API_BASE}/api/tasks/${taskId}/nearby-places/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Token ${token}`,
                    },
                    body: JSON.stringify(payload),
                });

                const data = await res.json();
                if (requestId !== activeRequestRef.current) return;

                if (!res.ok) {
                    setNearbyError(data?.message || data?.error || 'Failed to load nearby places');
                    return;
                }

                setNearbyPlaces(Array.isArray(data.places) ? data.places : []);
                setMapImageUrl(data.map_image_url || null);
                setSearchInfo({
                    query: data.query,
                    categoryLabel: data.category_label,
                    radius: data.radius_m,
                    locationSource: data.location_source,
                    message: data.message,
                });
                setNearbyError(data.message || '');
            } catch (error) {
                if (requestId !== activeRequestRef.current) return;
                console.error('Nearby places load error:', error);
                setNearbyError('Could not load nearby places');
            } finally {
                if (requestId === activeRequestRef.current) {
                    setNearbyLoading(false);
                }
            }
        };

        loadNearbyPlaces();
    }, [visible, taskId, API_BASE, token, currentLocation?.coords?.latitude, currentLocation?.coords?.longitude]);

    useEffect(() => {
        if (!visible) {
            lastSearchKeyRef.current = '';
        }
    }, [visible]);

    if (!task) return null;

    const dateInfo = formatDate(task.dueDate);
    const hasNearbyPlaces = nearbyPlaces.length > 0;

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

                <View style={styles.sheet}>
                    <View style={styles.handle} />
                    <View style={[styles.statusStrip, task.isCompleted ? styles.stripDone : styles.stripPending]} />

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                        <View style={styles.titleRow}>
                            <Text style={[styles.title, task.isCompleted && styles.titleDone]} numberOfLines={3}>
                                {task.title}
                            </Text>
                            <View style={[styles.statusPill, task.isCompleted ? styles.pillDone : styles.pillPending]}>
                                <Text style={[styles.statusPillText, task.isCompleted ? styles.pillTextDone : styles.pillTextPending]}>
                                    {task.isCompleted ? 'Completed ✓' : 'in process'}
                                </Text>
                            </View>
                        </View>

                        {dateInfo ? (
                            <TouchableOpacity style={styles.dateChip} onPress={() => onEdit(task)} activeOpacity={0.7}>
                                <Text style={styles.dateChipIcon}>⏰</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.dateChipDay}>Reminder</Text>
                                    <Text style={styles.dateChipTime}>{dateInfo.day}</Text>
                                    <Text style={styles.dateChipTime}>{dateInfo.time}</Text>
                                </View>
                                <Text style={styles.dateChipEdit}>edit ›</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={styles.dateChipEmpty} onPress={() => onEdit(task)}>
                                <Text style={styles.dateChipEmptyText}>+ Add reminder</Text>
                            </TouchableOpacity>
                        )}

                        <View style={styles.aiCard}>
                            <View style={styles.aiCardHeader}>
                                <Text style={styles.aiCardIcon}>📍</Text>
                                <Text style={styles.aiCardLabel}>Nearby places</Text>
                            </View>

                            <Text style={styles.aiSubtitle}>
                                {searchInfo?.categoryLabel || task.locationQuery || 'We looked for places that can help with this task'}
                            </Text>

                            {nearbyLoading ? (
                                <View style={styles.loadingBox}>
                                    <ActivityIndicator size="small" color="#7C3AED" />
                                    <Text style={styles.loadingText}>Searching around you...</Text>
                                </View>
                            ) : nearbyError && !hasNearbyPlaces ? (
                                <View style={styles.emptyMapBox}>
                                    <Text style={styles.emptyMapText}>{nearbyError}</Text>
                                    <Text style={styles.emptyMapSubText}>
                                        Sync your location in Settings if the app does not have a saved position.
                                    </Text>
                                </View>
                            ) : (
                                <>
                                    <View style={styles.mapBox}>
                                        {mapImageUrl ? (
                                            <Image source={{ uri: mapImageUrl }} style={styles.mapImage} resizeMode="cover" />
                                        ) : (
                                            <View style={styles.mapFallback}>
                                                <Text style={styles.mapFallbackText}>Map preview unavailable</Text>
                                            </View>
                                        )}
                                    </View>

                                    {searchInfo?.locationSource ? (
                                        <Text style={styles.metaText}>
                                            Using {searchInfo.locationSource.replace(/_/g, ' ')}{searchInfo.radius ? ` • radius ${searchInfo.radius}m` : ''}
                                        </Text>
                                    ) : null}

                                    {hasNearbyPlaces ? (
                                        <View style={styles.placesList}>
                                            {nearbyPlaces.map((place, index) => (
                                                <TouchableOpacity
                                                    key={`${place.name}-${place.lat}-${place.lng}-${index}`}
                                                    style={styles.placeItem}
                                                    activeOpacity={0.75}
                                                    onPress={() => openPlace(place)}
                                                >
                                                    <View style={styles.placeRank}>
                                                        <Text style={styles.placeRankText}>{index + 1}</Text>
                                                    </View>
                                                    <View style={styles.placeTextWrap}>
                                                        <Text style={styles.placeName} numberOfLines={1}>{place.name}</Text>
                                                        {!!place.address && <Text style={styles.placeAddress} numberOfLines={2}>{place.address}</Text>}
                                                        <Text style={styles.placeMeta}>
                                                            {place.category ? `${place.category} • ` : ''}{formatDistance(place.distance_m)} away
                                                        </Text>
                                                    </View>
                                                    <Text style={styles.openIcon}>↗</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    ) : null}
                                </>
                            )}
                        </View>

                        <View style={styles.iconRow}>
                            <TouchableOpacity style={styles.iconTile} onPress={() => onEdit(task)}>
                                <Text style={styles.iconTileEmoji}>✏️</Text>
                                <Text style={styles.iconTileLabel}>edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.iconTile, styles.iconTileDestructive]}
                                onPress={() => onDelete(task._id || task.id)}>
                                <Text style={styles.iconTileEmoji}>🗑️</Text>
                                <Text style={[styles.iconTileLabel, styles.iconTileLabelDestructive]}>delete</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={[styles.cta, task.isCompleted ? styles.ctaUndo : styles.ctaDo]}
                            onPress={() => onToggle(task)}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.ctaText, task.isCompleted ? styles.ctaTextUndo : styles.ctaTextDo]}>
                                {task.isCompleted ? '↩  Return to list' : '✓  Mark as done'}
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
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: { backgroundColor: '#FAFAFA', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', maxHeight: '88%' },
    handle: { width: 36, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
    statusStrip: { height: 3, marginHorizontal: 20, borderRadius: 2, marginBottom: 8 },
    stripPending: { backgroundColor: '#FCD34D' },
    stripDone: { backgroundColor: '#6EE7B7' },
    content: { paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 28 },
    titleRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 14, marginTop: 4 },
    title: { flex: 1, fontSize: 22, fontWeight: '800', color: '#111827', textAlign: 'right', lineHeight: 30 },
    titleDone: { textDecorationLine: 'line-through', color: '#9CA3AF' },
    statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start', marginTop: 4 },
    pillPending: { backgroundColor: '#FEF3C7' },
    pillDone: { backgroundColor: '#D1FAE5' },
    statusPillText: { fontSize: 12, fontWeight: '700' },
    pillTextPending: { color: '#92400E' },
    pillTextDone: { color: '#065F46' },
    dateChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
    dateChipIcon: { fontSize: 22 },
    dateChipDay: { fontSize: 14, fontWeight: '700', color: '#1F2937', textAlign: 'right' },
    dateChipTime: { fontSize: 13, color: '#6B7280', textAlign: 'right' },
    dateChipEdit: { fontSize: 12, color: '#6B7280' },
    dateChipEmpty: { alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 14, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed' },
    dateChipEmptyText: { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },
    aiCard: { backgroundColor: '#F5F3FF', borderRadius: 18, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#DDD6FE' },
    aiCardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 6 },
    aiCardIcon: { fontSize: 16 },
    aiCardLabel: { fontSize: 13, fontWeight: '800', color: PURPLE, letterSpacing: 0.5 },
    aiSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 12, textAlign: 'right' },
    loadingBox: { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    loadingText: { marginTop: 8, color: '#6B7280', fontWeight: '600' },
    emptyMapBox: { backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 8 },
    emptyMapText: { fontSize: 14, color: '#111827', fontWeight: '700', textAlign: 'center', marginBottom: 6 },
    emptyMapSubText: { fontSize: 12, color: '#6B7280', textAlign: 'center' },
    mapBox: { minHeight: 180, backgroundColor: '#EDE9FE', borderRadius: 14, overflow: 'hidden', marginBottom: 10 },
    mapImage: { width: '100%', height: 180, backgroundColor: '#EDE9FE' },
    mapFallback: { minHeight: 180, justifyContent: 'center', alignItems: 'center' },
    mapFallbackText: { color: '#7C3AED', fontWeight: '700' },
    metaText: { fontSize: 12, color: '#6B7280', marginBottom: 10 },
    placesList: { gap: 10 },
    placeItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
    placeRank: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
    placeRankText: { color: PURPLE, fontWeight: '800', fontSize: 12 },
    placeTextWrap: { flex: 1 },
    placeName: { fontSize: 15, fontWeight: '800', color: '#111827', textAlign: 'right' },
    placeAddress: { fontSize: 12, color: '#6B7280', textAlign: 'right', marginTop: 2 },
    placeMeta: { fontSize: 11, color: '#7C3AED', marginTop: 4, textAlign: 'right', fontWeight: '600' },
    openIcon: { fontSize: 18, color: '#7C3AED', fontWeight: '800' },
    iconRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    iconTile: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 13, borderWidth: 1, borderColor: '#E5E7EB' },
    iconTileDestructive: { borderColor: '#FEE2E2', backgroundColor: '#FFF5F5' },
    iconTileEmoji: { fontSize: 20 },
    iconTileLabel: { fontSize: 14, fontWeight: '700', color: '#374151' },
    iconTileLabelDestructive: { color: '#EF4444' },
    cta: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
    ctaDo: { backgroundColor: GREEN },
    ctaUndo: { backgroundColor: '#F3F4F6' },
    ctaText: { fontSize: 16, fontWeight: '800' },
    ctaTextDo: { color: '#fff' },
    ctaTextUndo: { color: '#6B7280' },
});