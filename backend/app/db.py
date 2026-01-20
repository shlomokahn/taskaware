from pymongo import MongoClient
from .config import Config

# יצירת החיבור
client = MongoClient(Config.MONGO_URI)
db = client.TaskAwareDB

# חשיפת הקולקשנים לשימוש בקבצים אחרים
users_collection = db.users
tasks_collection = db.tasks

# יצירת אינדקסים (ניתן גם להעביר לפונקציית אתחול בנפרד)
try:
    users_collection.create_index("username", unique=True)
    tasks_collection.create_index([("location_trigger", "2dsphere")])
    print("MongoDB indexes created/verified.")
except Exception as e:
    print(f"Warning creating indexes: {e}")