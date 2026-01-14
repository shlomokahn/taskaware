# -*- coding: utf-8 -*-
import os
from app import create_app

# Initialize the Flask application using the factory pattern
app = create_app()

if __name__ == '__main__':
    # Get port from environment variable (required for Render) or default to 3000
    port = int(os.environ.get("PORT", 3000))
    
    # Run the app on 0.0.0.0 to make it accessible externally
    app.run(host='0.0.0.0', port=port)