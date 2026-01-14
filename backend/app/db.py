import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

client = MongoClient(os.getenv("MONGO_URI"))
db = client.TaskAwareDB

# ייצוא הקולקשנים לשימוש בשאר הקבצים
users_collection = db.users
tasks_collection = db.tasks

def init_db():
    """אתחול אינדקסים חיוניים"""
    users_collection.create_index("username", unique=True)
    tasks_collection.create_index([("location_trigger", "2dsphere")])
    print("✅ Database indices initialized")