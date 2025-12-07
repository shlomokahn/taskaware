import { StyleSheet, Text, View } from 'react-native';

// הרכיב הראשי של האפליקציה שלך
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Hello World</Text>
    </View>
  );
}

// הגדרות עיצוב (סטייל)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#759774ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 32, // גודל פונט גדול
    fontWeight: 'bold',
    color: '#782727ff',
  },
});