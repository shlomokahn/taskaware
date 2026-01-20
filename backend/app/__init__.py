from flask import Flask, jsonify
from .config import Config

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Health Check
    @app.route('/health', methods=['GET'])
    def health_check():
        return jsonify(status="OK", db="Connected"), 200

    # רישום Blueprints
    from app.routes.auth import auth_bp
    from app.routes.tasks import tasks_bp
    from app.routes.user import user_bp

    # Prefix מגדיר את התחילית לכל הראוטים בקובץ
    app.register_blueprint(auth_bp, url_prefix='/api')       # /api/login, /api/signup
    app.register_blueprint(tasks_bp, url_prefix='/api/tasks') # /api/tasks/
    app.register_blueprint(user_bp, url_prefix='/api/user')   # /api/user/location

    return app