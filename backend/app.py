# backend/app.py
import os
import json
from datetime import datetime
from flask import Flask, request, jsonify
from pymongo import MongoClient, DESCENDING
from bson.objectid import ObjectId
from dotenv import load_dotenv

# טוען משתני סביבה מקובץ.env מקומי (יעיל רק בפיתוח)
load_dotenv() 

# --- 1. קונפיגורציה וחיבור ל-MongoDB Atlas ---
# MONGO_URI יילקח ממשתני הסביבה (process.env ב-Node)
# הערך נלקח מ-Render בפרודקשן
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/") # ברירת מחדל לפיתוח

# יצירת מופע של Flask (תחליף ל-Express)
app = Flask(__name__)

# הגדרת אובייקט החיבור ל-DB
try:
    client = MongoClient(MONGO_URI)
    db = client.TaskAwareDB # שם מסד הנתונים: TaskAwareDB
    tasks_collection = db.tasks # קולקציית המשימות
    print("Successfully connected to MongoDB Atlas!")
except Exception as e:
    print(f"Connection error: {e}")
    # יציאה מתוכנית אם החיבור נכשל
    # exit() 

# --- 2. פונקציית עזר להמרת ObjectId ---
def mongo_to_json(task):
    """ממיר אובייקט מונגו למבנה JSON קריא ללקוח (מטפל ב-ObjectId ובזמנים)."""
    if task:
        task['_id'] = str(task['_id'])
        # לוודא ששם השדה מתאים לצד הלקוח אם יש צורך בהמרות נוספות
    return task

# --- 3. הגדרת נקודות הקצה (Endpoints) - CRUD ---

# נקודת בדיקת תקינות (Health Check)
@app.route('/health', methods=["GET"])
def health_check():
    # בדיקה האם החיבור ל-DB פעיל (בדיקה קלה)
    db_status = 'Connected' if client.admin.command('ping')['ok'] == 1 else 'Disconnected'
    return jsonify(status="OK", db=db_status), 200

# A. READ: שליפת כל המשימות (GET /api/tasks)
@app.route('/api/tasks', methods=["GET"])
def get_tasks():
    try:
        # שליפת כל המסמכים ומיון לפי יצירה
        tasks_cursor = tasks_collection.find().sort("createdAt", DESCENDING)
        # המרת כל אובייקט במערך לפורמט JSON קריא
        tasks = [mongo_to_json(task) for task in tasks_cursor]
        return jsonify(tasks), 200
    except Exception as e:
        return jsonify({"msg": "Server Error fetching tasks", "error": str(e)}), 500

# B. CREATE: יצירת משימה חדשה (POST /api/tasks)
@app.route('/api/tasks', methods=["POST"])
def create_task():
    try:
        data = request.json
        title = data.get('title')

        if not title:
            return jsonify({"msg": "Please enter a title for the task"}), 400

        new_task = {
            "title": title,
            "isCompleted": False,
            "createdAt": datetime.utcnow() # זמן יצירה
        }

        result = tasks_collection.insert_one(new_task)
        new_task['_id'] = result.inserted_id

        return jsonify(mongo_to_json(new_task)), 201
    except Exception as e:
        return jsonify({"msg": "Server Error creating task", "error": str(e)}), 500

# C. UPDATE: עדכון משימה (PUT /api/tasks/<id> - סימון כבוצעה)
@app.route('/api/tasks/<id>', methods=["PUT"])
def update_task(id):
    try:
        data = request.json
        is_completed = data.get('isCompleted')

        # עדכון המסמך ב-MongoDB לפי ה-ID
        result = tasks_collection.update_one(
            {"_id": ObjectId(id)},
            {"$set": {"isCompleted": is_completed}}
        )

        if result.matched_count == 0:
            return jsonify({"msg": "Task not found"}), 404

        # שליפת המסמך המעודכן
        updated_task = tasks_collection.find_one({"_id": ObjectId(id)})
        return jsonify(mongo_to_json(updated_task)), 200

    except Exception as e:
        return jsonify({"msg": "Server Error updating task", "error": str(e)}), 500

if __name__ == '__main__':
    # פיתוח מקומי בלבד
    app.run(debug=True, port=3000)