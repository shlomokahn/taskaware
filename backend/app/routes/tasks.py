from flask import Blueprint, request, jsonify
from bson.objectid import ObjectId
from app.db import tasks_collection
from app.utils import token_required, mongo_to_json
import datetime
from pymongo import DESCENDING

tasks_bp = Blueprint('tasks', __name__)

@tasks_bp.route('/api/tasks', methods=['GET'])
@token_required
def get_tasks(current_user):
    tasks_cursor = tasks_collection.find({"user_id": current_user['_id']}).sort("createdAt", DESCENDING)
    return jsonify(mongo_to_json(list(tasks_cursor))), 200

@tasks_bp.route('/api/tasks', methods=['POST'])
@token_required
def create_task(current_user):
    data = request.json
    new_task = {
        "user_id": current_user['_id'],
        "title": data.get('title'),
        "isCompleted": False,
        "createdAt": datetime.datetime.now(datetime.timezone.utc),
        "location_trigger": None
    }
    result = tasks_collection.insert_one(new_task)
    new_task['_id'] = result.inserted_id
    return jsonify(mongo_to_json(new_task)), 201

@tasks_bp.route('/api/tasks/<task_id>', methods=['PUT'])
@token_required
def update_task(current_user, task_id):
    data = request.json
    update_fields = {k: v for k, v in data.items() if k in ['isCompleted', 'title']}
    
    result = tasks_collection.find_one_and_update(
        {"_id": ObjectId(task_id), "user_id": current_user['_id']},
        {"$set": update_fields},
        return_document=True
    )
    return jsonify(mongo_to_json(result)) if result else (jsonify({"msg": "Not found"}), 404)