import { useEffect, useState, useRef } from 'react';
import * as Location from 'expo-location';

export const useLocationSync = (API_BASE, token) => {
    const [location, setLocation] = useState(null);
    const [locationName, setLocationName] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const subscriptionRef = useRef(null);

    const getAddressName = async (latitude, longitude) => {
        try {
            const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (geocode && geocode.length > 0) {
                const item = geocode[0];
                const streetStr = item.street ? `${item.street}${item.streetNumber ? ` ${item.streetNumber}` : ''}` : '';
                const cityStr = item.city || '';
                const addressStr = [streetStr, cityStr].filter(Boolean).join(' ');
                if (addressStr) return addressStr;
                if (item.name) return item.name;
            }
        } catch (error) {
            console.log('Error reverse geocoding location with Expo:', error);
        }

        // Fallback to OpenStreetMap Nominatim API if native geocoding is unavailable or returns nothing
        try {
            console.log('Attempting Nominatim fallback geocoding...');
            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=he`,
                {
                    headers: {
                        'User-Agent': 'TaskAwareApp/1.0'
                    }
                }
            );
            if (res.ok) {
                const data = await res.json();
                if (data && data.address) {
                    const addr = data.address;
                    const road = addr.road || addr.street || addr.suburb || addr.pedestrian || '';
                    const houseNumber = addr.house_number || '';
                    const city = addr.city || addr.town || addr.village || addr.city_district || '';
                    
                    const streetStr = road ? `${road}${houseNumber ? ` ${houseNumber}` : ''}` : '';
                    const addressStr = [streetStr, city].filter(Boolean).join(' ');
                    if (addressStr) return addressStr;
                    if (data.display_name) return data.display_name;
                }
            }
        } catch (err) {
            console.log('Nominatim geocoding error:', err);
        }

        return 'Location updated';
    };

    const syncLocation = async () => {
        if (!token) return { success: false, error: 'No token' };

        setIsSyncing(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setIsSyncing(false);
                return { success: false, error: 'Permission denied' };
            }

            try {
                let { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
                if (bgStatus !== 'granted') {
                    console.log('⚠️ Background location permission denied');
                }
            } catch (bgErr) {
                console.log('Failed to request background location permission:', bgErr);
            }

            // Get current initial position
            let loc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            setLocation(loc);

            // Resolve geocode address name asynchronously without blocking
            getAddressName(loc.coords.latitude, loc.coords.longitude).then(addressName => {
                setLocationName(addressName);
            }).catch(err => {
                console.log('Geocoding error:', err);
            });

            const res = await fetch(`${API_BASE}/api/location/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                },
                body: JSON.stringify({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                }),
            });

            setIsSyncing(false);

            if (res.ok) {
                console.log('✅ Initial location synced successfully');
                return { success: true };
            } else {
                console.log('⚠️ Server rejected location update (' + res.status + ')');
                return { success: false, error: 'Server error' };
            }

        } catch (error) {
            console.log('Error syncing location:', error);
            setIsSyncing(false);
            return { success: false, error: error.message };
        }
    };

    // Auto watch location in foreground when token is active
    useEffect(() => {
        let active = true;

        const startWatching = async () => {
            if (!token || !API_BASE) return;

            try {
                // Request permissions
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;

                // Sync initial location once
                await syncLocation();

                // Start watching with 150m interval (token/battery optimization)
                if (subscriptionRef.current) {
                    subscriptionRef.current.remove();
                }

                subscriptionRef.current = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.Balanced,
                        distanceInterval: 150,
                    },
                    async (newLoc) => {
                        if (!active) return;
                        console.log('📍 Foreground location moved > 150m, syncing...');
                        setLocation(newLoc);

                        getAddressName(newLoc.coords.latitude, newLoc.coords.longitude).then(addressName => {
                            if (active) setLocationName(addressName);
                        }).catch(err => {
                            console.log('Geocoding error:', err);
                        });

                        try {
                            await fetch(`${API_BASE}/api/location/`, {
                                method: 'PATCH',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Token ${token}`
                                },
                                body: JSON.stringify({
                                    latitude: newLoc.coords.latitude,
                                    longitude: newLoc.coords.longitude,
                                }),
                            });
                        } catch (err) {
                            console.log('Error auto-syncing location:', err);
                        }
                    }
                );
            } catch (err) {
                console.log('Error setting up location watch:', err);
            }
        };

        startWatching();

        return () => {
            active = false;
            if (subscriptionRef.current) {
                subscriptionRef.current.remove();
                subscriptionRef.current = null;
            }
        };
    }, [token, API_BASE]);

    return { location, locationName, syncLocation, isSyncing };
};