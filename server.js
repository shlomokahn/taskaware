// server.js

// 1. ייבוא חבילות
const express = require('express');
const app = express();
const mockTasks = require('./mock-tasks'); // ייבוא רשימת המשימות

// הגדרת פורט (Port) שבו השרת יאזין
const PORT = 3000; 

// 2. Middleware – שימוש ב-JSON
// זה מאפשר ל-Express לקבל ולשלוח נתונים בפורמט JSON.
app.use(express.json()); 

// 3. הגדרת נקודת הקצה (GET Endpoint) לכל המשימות
// זו הכתובת שהאפליקציה של בן זוגך תצטרך לקרוא (http://:3000/api/tasks)
app.get('/api/tasks', (req, res) => {
  // המשימה: להחזיר את כל המשימות המדומות.
  // הפונקציה res.json() שולחת את הנתונים כמענה בפורמט JSON.
  console.log('Request received for /api/tasks. Sending mock data.');
  res.json(mockTasks);
});

// 4. הגדרת נקודת קצה (Endpoint) לבדיקת תקינות (Health Check)
app.get('/health', (req, res) => {
    res.status(200).send({ status: 'OK', message: 'TaskAware Mock Server is running.' });
});

// 5. הפעלת השרת
app.listen(PORT, () => {
  console.log(`TaskAware Backend Mock Server listening on port ${PORT}`);
  console.log(`Access tasks at: http://localhost:${PORT}/api/tasks`);
});