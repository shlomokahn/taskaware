import { useState } from 'react';
import * as Location from 'expo-location';

export const useLocationSync = (API_BASE, token) => {
    const [location, setLocation] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);

    const syncLocation = async () => {
        if (!token) return { success: false, error: 'No token' };

        setIsSyncing(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setIsSyncing(false);
                return { success: false, error: 'Permission denied' };
            }

            let loc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            setLocation(loc);

            const res = await fetch(`${API_BASE}/api/location/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                },
                body: JSON.stringify({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    address: "Israel" // כאן אפשר להוסיף המרת קואורדינטות לכתובת אם תרצה בעתיד
                }),
            });

            setIsSyncing(false);

            if (res.ok) {
                console.log('✅ מיקום סונכרן בהצלחה');
                return { success: true };
            } else {
                console.log('⚠️ שרת סירב לעדכון (' + res.status + ')');
                return { success: false, error: 'Server error' };
            }

        } catch (error) {
            console.log('Error syncing location:', error);
            setIsSyncing(false);
            return { success: false, error: error.message };
        }
    };

    return { location, syncLocation, isSyncing };
};