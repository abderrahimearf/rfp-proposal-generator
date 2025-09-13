import os
from dotenv import load_dotenv
from pathlib import Path
from pymongo import MongoClient
import certifi
load_dotenv()

class Config:
    # Flask
    DEBUG = os.getenv("DEBUG", "false").lower() == "true"
    SECRET_KEY = os.getenv("APP_SECRET", "change-this")
    TMP_DIR = Path("./tmp")
    TMP_FILE_PATH = str(TMP_DIR / "upload.tmp")
    # Supabase
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")

    # SMTP
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = os.getenv("SMTP_USER")
    SMTP_PASS = os.getenv("SMTP_PASS")

    # OTP
    OTP_PEPPER = os.getenv("OTP_PEPPER", "change-me")
    OTP_TTL_SEC = int(os.getenv("OTP_TTL_SEC", "600"))
    RESEND_INTERVAL_SEC = int(os.getenv("RESEND_INTERVAL_SEC", "60"))
    REG_TOKEN_TTL_MIN = int(os.getenv("REG_TOKEN_TTL_MIN", "15"))
    #weaviate
    WEAVIATE_HOST = os.getenv("WEAVIATE_HOST", "localhost")
    WEAVIATE_HTTP_PORT = int(os.getenv("WEAVIATE_HTTP_PORT", "8080"))
    WEAVIATE_GRPC_PORT = int(os.getenv("WEAVIATE_GRPC_PORT", "50051"))
    
    
# chunking + modèle
    EMBED_MODEL     = os.getenv("EMBED_MODEL", "intfloat/multilingual-e5-small")
    CHUNK_MAX_CHARS      = int(os.getenv("CHUNK_MAX_CHARS", "1200"))
    CHUNK_OVERLAP  = int(os.getenv("CHUNK_OVERLAP", "200"))


    HYBRID_ALPHA = 0.5
    SEARCH_TOP_K = 1

    api_key = "AIzaSyDqV770pDFn5z_seVND3S20C0d_TNhYtH8"


    # MongoDB
    

    MONGO_URI = os.getenv("MONGO_URI")
    if not MONGO_URI:
        raise RuntimeError("MONGO_URI manquant dans .env")

    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "docgen")
    MONGO_CLIENT = MongoClient(MONGO_URI, tls=True, tlsCAFile=certifi.where())
    MONGO_DB = MONGO_CLIENT[MONGO_DB_NAME]

    
    MONGO_CONNECT_TIMEOUT_MS = int(os.getenv("MONGO_CONNECT_TIMEOUT_MS", "8000"))
    MONGO_SERVER_SELECTION_TIMEOUT_MS = int(os.getenv("MONGO_SERVER_SELECTION_TIMEOUT_MS", "8000"))