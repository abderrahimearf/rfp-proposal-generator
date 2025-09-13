

import os
from supabase import create_client, Client
from dotenv import load_dotenv


load_dotenv()


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") 


if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError(
        "Veuillez définir SUPABASE_URL et SUPABASE_SERVICE_KEY dans votre fichier .env"
    )


supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("Client Supabase initialisé avec succès.")