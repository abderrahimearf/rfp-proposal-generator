# backend/backend/app.py
import os
from flask import Flask
from flask_cors import CORS
from config import Config
from dotenv import load_dotenv

load_dotenv()


print(" [APP DÉMARRAGE] Importation des services pour pré-chargement...")

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, resources={r"/api/*": {"origins": "*"}})
    app.url_map.strict_slashes = False

  
 
    from api.stock_doc import bp as stock_doc_bp
    
    from api.orchestrator import bp as orchestrator_bp
    from api.conversation import bp as conversation_bp
    from api.stock_prop import bp as stock_prop_bp
  
   
    app.register_blueprint(stock_doc_bp, url_prefix="/api/stock-doc")
   
    app.register_blueprint(orchestrator_bp, url_prefix="/api/orchestrator")
    app.register_blueprint(conversation_bp, url_prefix='/api/conversation')
    app.register_blueprint(stock_prop_bp, url_prefix="/api/stock-prop")

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app