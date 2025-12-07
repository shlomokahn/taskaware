// backend/server.js (הגרסה המעודכנת)
const express = require('express');
const mongoose = require('mongoose');
const Task = require('./models/Task'); // ייבוא מודל המשימה מתוך תיקיית models

const app = express();
const PORT = 3000; 

// *** שים כאן את ה-MONGO_URI המלא שלך מ-MongoDB Atlas (זמני לבדיקה מקומית) ***
// (מחליף את <USER>, <PASSWORD> וכו' בערכים האמיתיים שקיבלת מ-Atlas)
const MONGO_URI = "mongodb+srv://taskaware:taskaware@cluster0.pje4pip.mongodb.net/?appName=Cluster0"; 

// חיבור ל-MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('Successfully connected to MongoDB Atlas!'))
  .catch(err => console.error('Connection error:', err));

// Middleware - כדי ש-Express יבין נתוני JSON
app.use(express.json()); 

// ------------------------------------------------------------------
// A. READ: שליפת כל המשימות (GET /api/tasks)
// ------------------------------------------------------------------
app.get('/api/tasks', async (req, res) => {
    try {
        // שולף את כל המשימות וממיין לפי תאריך יצירה יורד
        const tasks = await Task.find().sort({ createdAt: -1 }); 
        res.json(tasks);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error fetching tasks');
    }
});

// ------------------------------------------------------------------
// B. CREATE: יצירת משימה חדשה (POST /api/tasks)
// ------------------------------------------------------------------
app.post('/api/tasks', async (req, res) => {
    try {
        const { title } = req.body; 
        if (!title) {
            return res.status(400).json({ msg: 'Please enter a title for the task' });
        }

        const newTask = new Task({ title });
        const task = await newTask.save(); // שמירת המשימה בבסיס הנתונים
        res.status(201).json(task);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error creating task');
    }
});

// ------------------------------------------------------------------
// C. UPDATE: עדכון משימה (PUT /api/tasks/:id)
// ------------------------------------------------------------------
app.put('/api/tasks/:id', async (req, res) => {
    try {
        const taskId = req.params.id;
        const { isCompleted } = req.body;

        const updatedTask = await Task.findByIdAndUpdate(
            taskId,
            { isCompleted: isCompleted },
            { new: true } // מחזיר את האובייקט המעודכן
        );

        if (!updatedTask) {
            return res.status(404).json({ msg: 'Task not found' });
        }
        res.json(updatedTask);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error updating task');
    }
});

// נקודת בדיקת תקינות
app.get('/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1? 'Connected' : 'Disconnected';
    res.status(200).send({ status: 'OK', db: dbStatus });
});

// הפעלת השרת
app.listen(PORT, () => {
    console.log(`TaskAware Backend Server listening on port ${PORT}`);
});