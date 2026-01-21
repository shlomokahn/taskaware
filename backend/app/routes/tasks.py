from flask import Blueprint, request, jsonify
from app.db import tasks_collection
from app.utils import token_required, mongo_to_json
from bson.objectid import ObjectId
from pymongo import DESCENDING
import datetime

tasks_bp = Blueprint('tasks', __name__)

@tasks_bp.route('', methods=['GET'])
@token_required
def get_tasks(current_user):
    try:
        tasks_cursor = tasks_collection.find({"user_id": current_user['_id']}).sort("createdAt", DESCENDING)
        tasks = [mongo_to_json(task) for task in tasks_cursor]
        return jsonify(tasks), 200
    except Exception as e:
        return jsonify({"msg": "Failed to fetch tasks", "error": str(e)}), 500


@tasks_bp.route('/<task_id>', methods=['DELETE'])
@token_required
def delete_task(current_user, task_id):
    try:
        result = tasks_collection.delete_one({"_id": ObjectId(task_id), "user_id": current_user['_id']})
        if result.deleted_count == 0:
            return jsonify({"msg": "Task not found"}), 404
        return jsonify({"msg": "Task deleted"}), 200
    except Exception as e:
        return jsonify({"msg": "Delete failed", "error": str(e)}), 400

@tasks_bp.route('', methods=['POST'])
@token_required
def create_task(current_user):
    data = request.json
    title = data.get('title')
    if not title:
        return jsonify({"msg": "Task title required"}), 400

    new_task = {
        "user_id": current_user['_id'],
        "title": title,
        "isCompleted": False,
        "createdAt": datetime.datetime.now(datetime.timezone.utc),
        "nlp_extraction": None,
        "location_trigger": None
    }
    
    result = tasks_collection.insert_one(new_task)
    new_task['_id'] = result.inserted_id
    
    return jsonify(mongo_to_json(new_task)), 201

@tasks_bp.route('/<task_id>', methods=['PUT'])
@token_required
def update_task(current_user, task_id):
    try:
        # 1. קבלת המידע מהבקשה
        data = request.get_json()
        
        # 2. הכנת אובייקט העדכון
        # אנחנו בודקים מה נשלח ומעדכנים רק את זה
        update_fields = {}
        
        if 'title' in data:
            update_fields['title'] = data['title']
            
        if 'isCompleted' in data:
            update_fields['isCompleted'] = data['isCompleted']

        # אם לא נשלח שום שדה רלוונטי
        if not update_fields:
            return jsonify({"msg": "No fields to update"}), 400

        # 3. ביצוע העדכון ב-DB
        # חשוב מאוד: הסינון לפי user_id מבטיח שמשתמש לא יעדכן משימה של מישהו אחר!
        result = mongo.db.tasks.update_one(
            {'_id': ObjectId(task_id), 'user_id': current_user['_id']},
            {'$set': update_fields}
        )

        # 4. בדיקה אם המשימה נמצאה ועודכנה
        if result.matched_count == 0:
            return jsonify({"msg": "Task not found or unauthorized"}), 404

        # 5. שליפת המשימה המעודכנת כדי להחזיר אותה ל-Frontend
        updated_task = mongo.db.tasks.find_one({'_id': ObjectId(task_id)})
        
        # המרת ה-ObjectId למחרוזת (כדי שיהיה אפשר לשלוח כ-JSON)
        updated_task['_id'] = str(updated_task['_id'])
        updated_task['user_id'] = str(updated_task['user_id'])

        return jsonify(updated_task), 200

    except Exception as e:
        print(f"Error updating task: {e}")
        return jsonify({"msg": "Update failed", "error": str(e)}), 500