from flask import Flask
from flask_cors import CORS # מומלץ להתקין: pip install flask-cors
import os
from .db import init_db

def create_app():
    app = Flask(__name__)
    CORS(app) # מאפשר לפרונטנד לגשת לשרת
    app.config['SECRET_KEY'] = os.getenv("SECRET_KEY", "dev_secret")
    
    # אתחול DB
    init_db()

    # רישום נתיבים
    from .routes.auth import auth_bp
    from .routes.tasks import tasks_bp
    from .routes.location import location_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(tasks_bp)
    app.register_blueprint(location_bp)

    @app.route('/health')
    def health():
        return {"status": "ok"}

    return app