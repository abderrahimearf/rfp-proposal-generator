# backend/backend/api/orchestrator.py
# -*- coding: utf-8 -*-

import uuid
import threading
import json
from queue import Queue
from flask import Blueprint, request, jsonify, Response
import traceback


from services.supabase_client import supabase


try:
    from services.agents.orchestrateur_langgraph import OrchestrateurLangGraph
except ImportError:
    raise ImportError("Assurez-vous que votre fichier de service se nomme 'orchestrateur_langgraph.py' dans 'services/agents/'")


from .shared_sessions import orchestrator_sessions as sessions

bp = Blueprint('orchestrator', __name__)


LABELS_MAP_AO = {
  "Administratif & Processus": ["avis_appel_offres", "definitions_abreviations", "calendrier_planning", "eligibilite_conditions", "clarifications_visite", "soumission_instructions", "ouverture_plis", "validite_offre", "criteres_evaluation", "attribution_resultats"],
  "Technique & Périmètre": ["objet_perimetre", "exigences_techniques", "livrables_prestations", "delais_execution", "sla_qualite"],
  "Financier & Commercial": ["bordereau_prix_bpu", "decomposition_prix", "paiement_conditions", "revision_variation_prix"],
  "Juridique & Contractuel": ["garanties_cautions", "assurances", "penalites_sanctions", "propriete_confidentialite", "resiliation_litiges"],
  "Annexes": ["formulaires_modeles", "attestations_certificats", "plans_schemas_annexes"],
  "Présentation & Contact": ["presentation_entreprise", "references_projets", "contact_coordonnees"]
}
CLASSES_PROP = [
    "entreprise_et_references",
    "besoin_client",
    "solution_proposee",
    "offre_financiere",
    "cadre_contractuel",
    "synthese"
]

class RealFrontendInterface:
    def __init__(self, event_queue: Queue):
        self.queue = event_queue
    def send(self, event: str, payload: dict):
        self.queue.put({'event': event, 'payload': payload})

def run_orchestrator_task(orchestrator: OrchestrateurLangGraph):
    try:
        print(f"Démarrage de la tâche d'orchestration pour l'utilisateur {orchestrator.user_email}...")
        orchestrator.demarrer_generation()
    except Exception as e:
        print(f"ERREUR dans le thread de l'orchestrateur pour {orchestrator.user_email}: {e}")
        traceback.print_exc()
        orchestrator.frontend.send('error', {'message': f"Une erreur critique est survenue: {e}"})
    finally:
        print(f"Tâche d'orchestration terminée pour {orchestrator.user_email}.")
        orchestrator.frontend.send('generation_complete', {'message': 'Processus de génération terminé.'})

@bp.route('/start', methods=['POST'])
def start_generation():
    """
    MODIFIÉ : Endpoint pour démarrer une génération.
    Nécessite 'template' et 'user_id' pour récupérer la configuration.
    """
    data = request.json or {}
    template_brut = data.get("template")
    # MODIFIÉ : On attend 'user_id' au lieu de 'email' pour plus de sécurité.
    user_id = data.get("user_id")

    if not template_brut or not isinstance(template_brut, dict):
        return jsonify({"error": "Un objet 'template' valide est requis."}), 400
    if not user_id:
        return jsonify({"error": "Le champ 'user_id' est requis."}), 400

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
            return jsonify({"error": "Impossible de récupérer l'email de l'utilisateur."}), 500

     
        template_pour_orchestrateur = {
            "name": template_brut.get("name", "Nouveau Document"),
            "description": template_brut.get("description", ""),
            "sections": template_brut.get("sections", [])
        }

        session_id = str(uuid.uuid4())
        event_queue = Queue()
        frontend_interface = RealFrontendInterface(event_queue)

       
        orchestrator = OrchestrateurLangGraph(
            template=template_pour_orchestrateur,
            frontend=frontend_interface,
            labels_map_ao=LABELS_MAP_AO,
            available_classes_prop=CLASSES_PROP,
            user_email=user_email,
            user_settings=user_settings  # <-- INJECTION DE LA CONFIGURATION
        )
        
        sessions[session_id] = {'orchestrator': orchestrator, 'queue': event_queue}
        
        thread = threading.Thread(target=run_orchestrator_task, args=(orchestrator,))
        thread.daemon = True
        thread.start()
        
        return jsonify({"session_id": session_id, "user_email": user_email})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Erreur lors de l'initialisation de la génération: {e}"}), 500


@bp.route('/message', methods=['POST'])
def handle_user_message():

    data = request.json
    session_id = data.get('session_id')
    message = data.get('message')
    section_cible = data.get('section_cible')

    if not all([session_id, message, section_cible]):
        return jsonify({"error": "Les champs 'session_id', 'message', et 'section_cible' sont requis"}), 400
    
    session = sessions.get(session_id)
    if not session:
        return jsonify({"error": "ID de session invalide"}), 404

    orchestrator = session['orchestrator']
    thread = threading.Thread(target=orchestrator.gerer_message_utilisateur, args=(message, section_cible))
    thread.daemon = True
    thread.start()
    
    return jsonify({"status": "réponse reçue, reprise du traitement..."})

@bp.route('/stream/<session_id>')
def stream_events(session_id: str):

    session = sessions.get(session_id)
    if not session:
        return Response("ID de session invalide ou expirée", status=404)
    
    def event_generator():
        try:
            event_queue = session['queue']
            while True:
                event_data = event_queue.get()
                yield f"event: {event_data['event']}\ndata: {json.dumps(event_data['payload'])}\n\n"
                if event_data['event'] == 'generation_complete':
                    break
        except Exception as e:
            print(f"Erreur dans le générateur d'événements pour la session {session_id}: {e}")
        finally:
            print(f"Fermeture du flux pour la session {session_id}")
    
    return Response(event_generator(), mimetype='text/event-stream')