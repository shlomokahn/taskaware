// backend/models/Task.js
const mongoose = require('mongoose');

// הגדרת הסכמה (מבנה) של אובייקט המשימה
const TaskSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true // חובה להזין כותרת
    },
    isCompleted: { 
        type: Boolean, 
        default: false // ברירת מחדל: לא בוצע
    },
    // שדה זה יאפשר לנו למיין את המשימות לפי מתי נוצרו
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

// ייצוא המודל לשימוש ב-server.js
module.exports = mongoose.model('Task', TaskSchema);