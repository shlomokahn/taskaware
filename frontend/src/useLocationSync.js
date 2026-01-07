import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export const useLocationSync = (apiBaseUrl) => {
  const [location, setLocation] = useState(null);

  useEffect(() => {
    let intervalId = null;

    const startLoop = async () => {
      try {
        // 1. בקשת הרשאה
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('❌ אין הרשאת מיקום');
          return;
        }

        console.log('✅ יש הרשאה, מתחיל לשלוח מיקום כל 30 שניות...');

        // 2. לולאה שרצה כל 30 שניות (במקום האזנה פסיבית)
        intervalId = setInterval(async () => {
          try {
            const currentLocation = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });

            setLocation(currentLocation);

            // הדפסה לטרמינל כדי שתראה שזה עובד
console.log(`📍 [${new Date().toLocaleTimeString()}] שולח: ${currentLocation.coords.latitude}, ${currentLocation.coords.longitude}`);
            // שליחה לשרת
            if (apiBaseUrl) {
              sendLocationToBackend(apiBaseUrl, currentLocation.coords);
            }
          } catch (err) {
            console.log('Error getting location:', err.message);
          }
        }, 30000); // 30000 מילישניות = 30 שניות

      } catch (error) {
        console.log(`❌ שגיאה כללית: ${error.message}`);
      }
    };

    startLoop();

    // ניקוי כשהרכיב יורד
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [apiBaseUrl]);

  const sendLocationToBackend = async (url, coords) => {
    try {
      await fetch(`${url}/api/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: coords.latitude,
          longitude: coords.longitude,
        }),
      });
    } catch (err) {
      console.log(`⚠️ שגיאת שרת: ${err.message}`);
    }
  };

  // מחזירים רק את המיקום, בלי לוגים מיותרים
  return { location };
};