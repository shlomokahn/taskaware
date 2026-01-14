from flask import Blueprint, request, jsonify
import datetime
from app.db import users_collection
from app.utils import token_required

location_bp = Blueprint('location', __name__)

@location_bp.route('/api/user/location', methods=['POST'])
@token_required
def update_location(current_user):
    data = request.json
    lat, lng = data.get('latitude'), data.get('longitude')
    
    if lat is None or lng is None:
        return jsonify({"msg": "Invalid coords"}), 400
        
    users_collection.update_one(
        {"_id": current_user['_id']},
        {"$set": {
            "last_location": {"type": "Point", "coordinates": [lng, lat]},
            "last_updated": datetime.datetime.now(datetime.timezone.utc)
        }}
    )
    return jsonify({"msg": "Updated"}), 200