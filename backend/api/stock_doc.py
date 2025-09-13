# api/stock_doc.py
from flask import Blueprint, request, jsonify, current_app

bp = Blueprint("stock_doc", __name__)

@bp.get("/ping")
def stock_doc_ping():
    """Endpoint de health-check pour le service de documents."""
    return jsonify({"pong": "doc_service_ok"})

@bp.route("", methods=["POST"])
@bp.route("/", methods=["POST"])
def upload_document():
    """
    Endpoint pour uploader un document.
    Nécessite un formulaire multipart avec les champs 'file' et 'email'.
    Le service associé videra la collection de l'utilisateur avant d'indexer le nouveau document.
    """
    # Import différé pour ne pas bloquer le démarrage de l'application en cas de problème
    try:
        from services.stock_doc_service import save_and_index_document
    except Exception as e:
        current_app.logger.exception("Échec import save_and_index_document")
        return jsonify({"error": "Service d'indexation indisponible."}), 500

    # --- Validation du fichier ET de l'email (comme pour les propositions) ---
    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier reçu (champ 'file' manquant)."}), 400
    
    # Récupérer l'email depuis les champs du formulaire
    user_email = request.form.get("email")

    if not user_email:
        return jsonify({"error": "Email de l'utilisateur manquant (champ 'email')."}), 400

    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"error": "Nom de fichier vide."}), 400
   
    try:
        # Passer le fichier ET l'email au service, comme le demande la nouvelle signature de la fonction
        result = save_and_index_document(file, user_email)
        return jsonify(result), 201
        
    except ValueError as ve:
        # Erreur liée à une entrée invalide (ex: email mal formé)
        current_app.logger.error(f"Erreur de validation pour l'indexation de document de {user_email}: {ve}")
        return jsonify({"error": str(ve)}), 400
    except ConnectionError as ce:
        # Erreur spécifique à la connexion à Weaviate
        current_app.logger.exception(f"Erreur de connexion à Weaviate pour l'indexation de document de {user_email}")
        return jsonify({"error": f"Impossible de se connecter à la base de données vectorielle : {ce}"}), 503 # Service Unavailable
    except Exception:
        # Capturer toutes les autres erreurs internes
        current_app.logger.exception(f"Erreur interne lors de l'indexation du document pour {user_email}")
        return jsonify({"error": "Erreur interne lors de l'indexation du document."}), 500