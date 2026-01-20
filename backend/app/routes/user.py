
from flask import Blueprint, request, jsonify
from app.db import users_collection
from app.utils import token_required
import datetime

user_bp = Blueprint('user', __name__)

@user_bp.route('/location', methods=['POST'])
@token_required
def update_user_location(current_user):
    data = request.json
    lat = data.get('latitude')
    lng = data.get('longitude')
    
    if lat is None or lng is None:
        return jsonify({"msg": "Missing coordinates"}), 400
        
    users_collection.update_one(
        {"_id": current_user['_id']},
        {"$set": {
            "last_location": {
                "type": "Point",
                "coordinates": [lng, lat]
            },
            "last_updated": datetime.datetime.now(datetime.timezone.utc)
        }}
    )
    return jsonify({"msg": "Location updated"}), 200