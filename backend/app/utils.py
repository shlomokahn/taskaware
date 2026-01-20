from functools import wraps
from flask import request, jsonify, current_app
import jwt
from bson.objectid import ObjectId
from .db import users_collection # ייבוא ה-collection מהקובץ שיצרנו

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
            # שימוש ב-current_app כדי לגשת לקונפיגורציה
            data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = users_collection.find_one({"_id": ObjectId(data['user_id'])})
            if not current_user:
                return jsonify({'message': 'User not found!'}), 401
        except Exception as e:
            return jsonify({'message': 'Token is invalid!', 'error': str(e)}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated