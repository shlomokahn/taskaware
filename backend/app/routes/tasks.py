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

# --- עדכון סטטוס בלבד (מתוקן) ---
@tasks_bp.route('/<task_id>/status', methods=['PUT'])
@token_required
def update_task_status(current_user, task_id):
    try:
        data = request.get_json()
        
        if 'isCompleted' not in data:
            return jsonify({"msg": "Missing field: isCompleted"}), 400
            
        new_status = data['isCompleted']

        # תיקון: שימוש ב-tasks_collection במקום mongo.db.tasks
        result = tasks_collection.update_one(
            {'_id': ObjectId(task_id), 'user_id': current_user['_id']},
            {'$set': {'isCompleted': new_status}}
        )

        if result.matched_count == 0:
            return jsonify({"msg": "Task not found or unauthorized"}), 404

        # שליפת המשימה המעודכנת
        updated_task = tasks_collection.find_one({'_id': ObjectId(task_id)})
        
        # תיקון: שימוש בפונקציית העזר הקיימת שלך להמרה
        return jsonify(mongo_to_json(updated_task)), 200

    except Exception as e:
        print(f"Error updating status: {e}")
        return jsonify({"msg": "Update failed", "error": str(e)}), 500


# --- עדכון כותרת בלבד (מתוקן) ---
@tasks_bp.route('/<task_id>/title', methods=['PUT'])
@token_required
def update_task_title(current_user, task_id):
    try:
        data = request.get_json()
        
        if 'title' not in data or not data['title'].strip():
            return jsonify({"msg": "Missing or empty title"}), 400
            
        new_title = data['title'].strip()

        # תיקון: שימוש ב-tasks_collection במקום mongo.db.tasks
        result = tasks_collection.update_one(
            {'_id': ObjectId(task_id), 'user_id': current_user['_id']},
            {'$set': {'title': new_title}}
        )

        if result.matched_count == 0:
            return jsonify({"msg": "Task not found or unauthorized"}), 404

        # שליפת המשימה המעודכנת
        updated_task = tasks_collection.find_one({'_id': ObjectId(task_id)})

        # תיקון: שימוש בפונקציית העזר הקיימת שלך להמרה
        return jsonify(mongo_to_json(updated_task)), 200

    except Exception as e:
        print(f"Error updating title: {e}")
        return jsonify({"msg": "Update failed", "error": str(e)}), 500