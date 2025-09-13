# api/stock_prop.py
from flask import Blueprint, request, jsonify, current_app

bp = Blueprint("stock_prop", __name__)

@bp.get("/ping")
def stock_prop_ping():
    return jsonify({"pong": "prop_service_ok"})

@bp.route("", methods=["POST"])
@bp.route("/", methods=["POST"])
def upload_proposal():
    try:
        from services.stock_prop_service import save_and_index_proposal
    except Exception as e:
        current_app.logger.exception("Échec import save_and_index_proposal")
        return jsonify({"error": "Service d'indexation indisponible."}), 500

    # --- CHANGEMENT MAJEUR : Validation du fichier ET de l'email ---
    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier reçu (champ 'file' manquant)."}), 400
    
    # On récupère l'email depuis les champs du formulaire
    user_email = request.form.get("email")

    if not user_email:
        return jsonify({"error": "Email de l'utilisateur manquant (champ 'email')."}), 400

    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"error": "Nom de fichier vide."}), 400
   
    try:
        # On passe maintenant le fichier ET l'email au service
        result = save_and_index_proposal(file, user_email)
        return jsonify(result), 201
        
    except ValueError as ve:
        current_app.logger.error(f"Erreur de configuration ou de validation pour {user_email}: {ve}")
        return jsonify({"error": str(ve)}), 400
    except ConnectionError as ce:
        current_app.logger.exception(f"Erreur de connexion à Weaviate pour {user_email}")
        return jsonify({"error": f"Impossible de se connecter à la base de données vectorielle : {ce}"}), 503
    except Exception:
        current_app.logger.exception(f"Erreur interne lors de l'indexation pour {user_email}")
        return jsonify({"error": "Erreur interne lors de l'indexation de la proposition."}), 500