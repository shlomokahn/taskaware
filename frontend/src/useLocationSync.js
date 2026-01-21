// src/useLocationSync.js
import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

export const useLocationSync = (API_BASE, token) => {
    const [location, setLocation] = useState(null);

    useEffect(() => {
        if (!token) return;

        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.log('Permission to access location was denied');
                return;
            }

            let loc = await Location.getCurrentPositionAsync({});
            setLocation(loc);

            try {
                // שולחים את המיקום לשרת
                // שים לב: הוספנו / בסוף הכתובת ושינינו ל-PATCH
                const res = await fetch(`${API_BASE}/api/location/`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Token ${token}` // שינוי לפורמט Django
                    },
                    body: JSON.stringify({
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                        address: "Israel, Tel Aviv" // או כל דאטא אחר שאתה שולח
                    }),
                });

                if (!res.ok) {
                    console.log('⚠️ שרת סירב לעדכון מיקום (' + res.status + ')');
                } else {
                    console.log('✅ מיקום סונכרן בהצלחה');
                }

            } catch (error) {
                console.log('Error syncing location:', error);
            }
        })();
    }, [token]); // ירוץ כל פעם שהטוקן משתנה (כלומר כשנכנסים)

    return { location };
};