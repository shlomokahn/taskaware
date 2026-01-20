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
        data = request.json
        update_data = {}
        if 'isCompleted' in data:
            update_data['isCompleted'] = data['isCompleted']
        if 'title' in data:
            update_data['title'] = data['title']

        result = tasks_collection.find_one_and_update(
            {"_id": ObjectId(task_id), "user_id": current_user['_id']},
            {"$set": update_data},
            return_document=True
        )
        
        if not result:
            return jsonify({"msg": "Task not found"}), 404
            
        return jsonify(mongo_to_json(result)), 200
    except Exception as e:
        return jsonify({"msg": "Update failed", "error": str(e)}), 400