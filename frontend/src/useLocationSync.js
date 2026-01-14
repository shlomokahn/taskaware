import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useLocationSync = (apiBaseUrl, token) => {
    const [location, setLocation] = useState(null);

    useEffect(() => {
        let intervalId = null;

        const startLoop = async () => {
            // אם אין טוקן, אין טעם לנסות לשלוח לשרת
            if (!token) return;

            try {
                // 1. בקשת הרשאה
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    console.log('❌ אין הרשאת מיקום');
                    return;
                }

                console.log('✅ סנכרון מיקום פעיל (כל 30 שניות)');

                // 2. לולאת עדכון
                intervalId = setInterval(async () => {
                    try {
                        const currentLocation = await Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.Balanced,
                        });

                        setLocation(currentLocation);

                        // שליחה לשרת
                        if (apiBaseUrl && token) {
                            sendLocationToBackend(apiBaseUrl, token, currentLocation.coords);
                        }
                    } catch (err) {
                        console.log('Error getting location:', err.message);
                    }
                }, 30000);

            } catch (error) {
                console.log(`❌ שגיאה כללית במיקום: ${error.message}`);
            }
        };

        startLoop();

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [apiBaseUrl, token]); // הלולאה תתחיל מחדש אם הטוקן משתנה (למשל אחרי לוגין)

    const sendLocationToBackend = async (url, userToken, coords) => {
        try {
            const response = await fetch(`${url}/api/user/location`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': userToken // הוספת הטוקן לזיהוי המשתמש בשרת
                },
                body: JSON.stringify({
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                }),
            });

            if (response.ok) {
                console.log(`📍 [${new Date().toLocaleTimeString()}] מיקום עודכן בשרת`);
            } else {
                console.log(`⚠️ שרת סירב לעדכון מיקום (${response.status})`);
            }
        } catch (err) {
            console.log(`⚠️ שגיאת תקשורת במיקום: ${err.message}`);
        }
    };

    return { location };
};