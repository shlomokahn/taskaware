/**
 * TaskAware Frontend (Expo/React Native)
 * - מושך משימות מה-API, יוצר משימות חדשות, ומסמן כבוצע.
 * - כתובת ה-API נקבעת מ-EXPO_PUBLIC_API_BASE או ברירת המחדל כאן.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useLocationSync } from './src/useLocationSync.js';

// ניתן להגדיר בקובץ .env את EXPO_PUBLIC_API_BASE
// לדוגמה: EXPO_PUBLIC_API_BASE=http://localhost:3000
const API_BASE = 'https://taskaware-backend.onrender.com';

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

const { location } = useLocationSync(API_BASE);
  // לוגיקה מחושבת: רשימה ריקה? משמש לסגנון/תצוגה.
  const listEmpty = useMemo(() => tasks.length === 0, [tasks]);

  // שליפת כל המשימות מהשרת
  const fetchTasks = useCallback(async () => {
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/tasks`);
      if (!res.ok) throw new Error(`שגיאת שרת (${res.status})`);
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Fetch tasks error:', err);
      setError('לא הצלחנו לטעון משימות. בדוק חיבור וכתובת API.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // שליפה ראשונית בעת עלייה
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTasks();
  }, [fetchTasks]);

  // יצירת משימה חדשה
  const createTask = useCallback(async () => {
    const title = newTitle.trim();
    if (!title) {
      setError('צריך להזין כותרת למשימה');
      return;
    }

    setCreating(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error(`שגיאה ביצירה (${res.status})`);
      const created = await res.json();
      setTasks((prev) => [created, ...prev]);
      setNewTitle('');
    } catch (err) {
      console.warn('Create task error:', err);
      setError('לא ניתן ליצור משימה. בדוק שה-API זמין.');
    } finally {
      setCreating(false);
    }
  }, [newTitle]);

  // סימון/ביטול השלמת משימה
  const toggleTask = useCallback(async (task) => {
    const next = !task.isCompleted;
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${task._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: next }),
      });
      if (!res.ok) throw new Error(`שגיאה בעדכון (${res.status})`);
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t._id === task._id ? updated : t)));
    } catch (err) {
      console.warn('Update task error:', err);
      setError('לא ניתן לעדכן משימה. ודא חיבור לשרת.');
    }
  }, []);

  // רינדור שורה אחת של משימה
  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.taskRow}
      onPress={() => toggleTask(item)}
      activeOpacity={0.8}
    >
      <Text
        style={[
          styles.taskTitle,
          item.isCompleted ? styles.completedText : null,
        ]}
      >
        {item.title}
      </Text>
      <Text style={styles.statusIcon}>{item.isCompleted ? '✓' : '○'}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>TaskAware</Text>
      <Text style={styles.subBrand}>ניהול משימות </Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="כותרת משימה חדשה..."
          placeholderTextColor="#9aa0a6"
          value={newTitle}
          onChangeText={setNewTitle}
          editable={!creating}
          returnKeyType="done"
          onSubmitEditing={createTask}
        />
        <TouchableOpacity
          style={[
            styles.addBtn,
            (creating || !newTitle.trim()) && styles.addBtnDisabled,
          ]}
          onPress={createTask}
          disabled={creating || !newTitle.trim()}
        >
          {creating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.addBtnText}>+</Text>
          )}
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#2f855a" />
          <Text style={styles.loaderText}>טוען משימות...</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item._id ?? String(item.title)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={listEmpty && styles.emptyContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>אין משימות כרגע</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 18,
    backgroundColor: '#f7f9fb',
    gap: 12,
  },
  brand: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1f2937',
  },
  subBrand: {
    fontSize: 14,
    color: '#6b7280',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#2f855a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    opacity: 0.5,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 28,
  },
  error: {
    color: '#b91c1c',
    fontSize: 14,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loaderText: {
    color: '#4b5563',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginVertical: 6,
  },
  taskTitle: {
    fontSize: 16,
    color: '#111827',
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  statusIcon: {
    fontSize: 18,
    color: '#2f855a',
    fontWeight: '700',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 15,
  },
});