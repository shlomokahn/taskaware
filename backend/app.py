import os
import datetime
import jwt
import bcrypt
from flask import Flask, request, jsonify, make_response
from pymongo import MongoClient, DESCENDING
from bson.objectid import ObjectId
from functools import wraps
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# תיקון: הגדרת מפתח סודי בתוך אובייקט הקונפיגורציה
app.config['SECRET_KEY'] = os.getenv("SECRET_KEY", "taskaware_default_secret_key")

# --- 1. Database Connection ---
MONGO_URI = os.getenv("MONGO_URI")
try:
    client = MongoClient(MONGO_URI)
    db = client.TaskAwareDB
    users_collection = db.users
    tasks_collection = db.tasks
    
    users_collection.create_index("username", unique=True)
    tasks_collection.create_index([("location_trigger", "2dsphere")])
    
    print("Successfully connected to MongoDB Atlas!")
except Exception as e:
    print(f"Connection error: {e}")
    exit()

# --- 2. Security Middlewares ---

def mongo_to_json(data):
    if data:
        if isinstance(data, list):
            for item in data:
                item['_id'] = str(item['_id'])
                if 'user_id' in item:
                    item['user_id'] = str(item['user_id'])
        else:
            data['_id'] = str(data['_id'])
            if 'user_id' in data:
                data['user_id'] = str(data['user_id'])
    return data

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('x-access-token')
        
        if not token:
            return jsonify({'message': 'Authentication token is missing!'}), 401
            
        try:
            # תיקון: שימוש ב-app.config['SECRET_KEY'] והגדרת אלגוריתם
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = users_collection.find_one({"_id": ObjectId(data['user_id'])})
            if not current_user:
                return jsonify({'message': 'User not found!'}), 401
        except Exception as e:
            return jsonify({'message': 'Token is invalid!', 'error': str(e)}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated

# --- 3. Endpoints ---

@app.route('/api/signup', methods=['POST']) # תיקון: הוספת מתודה
def signup():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"msg": "Username and password are required"}), 400
    
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    try:
        user_id = users_collection.insert_one({
            "username": username,
            "password": hashed_password,
            "created_at": datetime.datetime.now(datetime.timezone.utc),
            "preferences": {"home_location": None, "work_location": None}
        }).inserted_id
        
        return jsonify({"msg": "Account created successfully", "user_id": str(user_id)}), 201
    except:
        return jsonify({"msg": "Username already exists"}), 409

@app.route('/api/login', methods=['POST']) # תיקון: הוספת מתודה
def login():
    auth = request.json
    if not auth or not auth.get('username') or not auth.get('password'):
        return make_response('Missing login details', 401)

    user = users_collection.find_one({"username": auth.get('username')})
    if not user:
        return make_response('User not found', 401)

    if bcrypt.checkpw(auth.get('password').encode('utf-8'), user['password']):
        # תיקון: שימוש במפתח הנכון מהקונפיג
        token = jwt.encode({
            'user_id': str(user['_id']),
            'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm="HS256")
        
        return jsonify({'token': token})

    return make_response('Invalid credentials', 401)

@app.route('/api/tasks', methods=['GET']) # תיקון: מתודת GET
@token_required
def get_tasks(current_user):
    try:
        tasks_cursor = tasks_collection.find({"user_id": current_user['_id']}).sort("createdAt", DESCENDING)
        tasks = [mongo_to_json(task) for task in tasks_cursor]
        return jsonify(tasks), 200
    except Exception as e:
        return jsonify({"msg": "Failed to fetch tasks", "error": str(e)}), 500

@app.route('/api/tasks', methods=['POST']) # תיקון: מתודת POST
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

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify(status="OK", db="Connected"), 200


# עדכון משימה (למשל סימון כבוצע)
@app.route('/api/tasks/<task_id>', methods=['PUT'])
@token_required
def update_task(current_user, task_id):
    try:
        data = request.json
        # מעדכנים רק את השדות ששלחנו ב-body
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

if __name__ == '__main__':
    app.run(debug=True, port=3000)