# backend/api/decorators.py
# -*- coding: utf-8 -*-

import os
from functools import wraps
from flask import request, jsonify
# NOUVEAU : Imports nécessaires pour créer le client ici-même
from dotenv import load_dotenv
from supabase import create_client, Client

# NOUVEAU : On charge les variables d'environnement
load_dotenv()

# NOUVEAU : On crée le client Supabase directement dans ce fichier
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL et SUPABASE_KEY sont requis dans votre fichier .env")

# On crée une instance du client spécifique à ce fichier
supabase_client: Client = create_client(supabase_url, supabase_key)


def token_required(f):
    """
    Décorateur pour vérifier la validité d'un jeton d'accès Supabase (JWT).
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            try:
                token = request.headers['Authorization'].split(" ")[1]
            except IndexError:
                return jsonify({"error": "Format du token invalide."}), 401

        if not token:
            return jsonify({"error": "Token d'authentification manquant."}), 401

        try:
            # MODIFIÉ : On utilise le client créé localement dans ce fichier
            user_response = supabase_client.auth.get_user(token)
            user = user_response.user
            if not user:
                 raise Exception("Token invalide ou expiré.")

        except Exception as e:
            print(f"Erreur de validation du token: {e}")
            return jsonify({"error": "Session invalide ou expirée."}), 401
        
        return f(user, *args, **kwargs)

    return decorated