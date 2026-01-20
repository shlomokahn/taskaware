from flask import Blueprint, request, jsonify, make_response, current_app
import bcrypt
import jwt
import datetime
from app.db import users_collection

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/signup', methods=['POST'])
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

@auth_bp.route('/login', methods=['POST'])
def login():
    auth = request.json
    if not auth or not auth.get('username') or not auth.get('password'):
        return make_response('Missing login details', 401)

    user = users_collection.find_one({"username": auth.get('username')})
    if not user:
        return make_response('User not found', 401)

    if bcrypt.checkpw(auth.get('password').encode('utf-8'), user['password']):
        token = jwt.encode({
            'user_id': str(user['_id']),
            'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)
        }, current_app.config['SECRET_KEY'], algorithm="HS256")
        
        return jsonify({'token': token})

    return make_response('Invalid credentials', 401)