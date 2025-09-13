

import uuid
import traceback
from flask import Blueprint, request, jsonify


from services.agents.conversation_manager import ConversationManager
from services.supabase_client import supabase

bp = Blueprint('conversation', __name__)


chat_sessions = {}

@bp.route('/chat/start', methods=['POST'])
def start_chat_session():
    data = request.json
    user_id = data.get('user_id')

    if not user_id:
        return jsonify({"error": "'user_id' est requis."}), 400

    try:
       
        params_response = supabase.table("parametres").select("*").eq("user_id", user_id).single().execute()
        if not params_response.data:
            return jsonify({"error": "Aucun paramètre de configuration trouvé pour cet utilisateur."}), 404
        user_settings = params_response.data

       
        try:
            user_response = supabase.auth.admin.get_user_by_id(user_id)
            user_email = user_response.user.email
            if not user_email:
                raise ValueError("L'email de l'utilisateur est vide.")
        except Exception as auth_error:
           
            print(f"Erreur d'authentification Supabase : {auth_error}")
            return jsonify({"error": "Impossible de récupérer l'email de l'utilisateur. Vérifiez les permissions."}), 500

     
        chat_manager = ConversationManager(
            user_settings=user_settings,
            user_email=user_email
        )
        
   
        chat_session_id = str(uuid.uuid4())
        chat_sessions[chat_session_id] = chat_manager
        
        initial_message = chat_manager.get_initial_message()
        
        return jsonify({
            "chat_session_id": chat_session_id,
            "initial_message": initial_message
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Erreur lors de l'initialisation du chat: {e}"}), 500



@bp.route('/send-message', methods=['POST'])
def handle_chat_message():
    if 'chat_session_id' not in request.form or 'message' not in request.form:
        return jsonify({"error": "'chat_session_id' et 'message' sont requis."}), 400

    chat_session_id = request.form['chat_session_id']
    message = request.form['message']
    image_file = request.files.get('image')

    chat_manager = chat_sessions.get(chat_session_id)
    if not chat_manager:
        return jsonify({"error": "ID de session de chat invalide."}), 404

    try:
        response_data = chat_manager.discuter(user_input=message, image_file=image_file)
        agent_text_response = response_data.get("output", "Une erreur est survenue.")
        
        return jsonify({
            "response": agent_text_response,
            "action": None
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Une erreur est survenue lors de la communication avec l'assistant."}), 500