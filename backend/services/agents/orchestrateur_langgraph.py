# backend/services/agents/orchestrateur_langgraph.py
# -- coding: utf-8 --

from __future__ import annotations

from dotenv import load_dotenv
import os
import re
import json
import time
import uuid
from typing import List, Dict, TypedDict, Literal, Optional, Any
import traceback

# --- Dépendances LangGraph ---
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

# --- Dépendances LLM et Projet ---
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage

# --- Import des fonctions de recherche ---
try:
    from .tools2 import serache_ao, serch_pro, get_weaviate_client
except ImportError:
    print("Attention: Impossible d'importer les outils depuis .tools. Fonctions factices utilisées.")
    def serache_ao(client, collection_name, sous_class_values, query_text, k): return [{"title": "Mock AO", "contenu": "Contenu de l'AO...", "classe": "mock_classe"}]
    def serch_pro(client, collection_name, class_values, query_text, k): return [{"content": "Contenu de proposition...", "title": "Mock Prop", "classes": "mock_classe", "_meta": {"distance": 0.1}}]
    def get_weaviate_client(): return None

# ==============================================================================
# SECTION 1 : PRIMITIVES (PROMPTS, OUTILS, CLIENT LLM)
# ==============================================================================

def _sanitize_email_for_collection_name(email: str, suffix: str) -> str:
    sanitized = re.sub(r'[^a-zA-Z0-9]', '', email)
    if not sanitized:
        raise ValueError("L'email fourni est invalide après nettoyage.")
    return sanitized.capitalize() + suffix

# CORRIGÉ : Vos prompts originaux sont restaurés ici
STRATEGIST_PROMPT_AO_TEMPLATE = """
Tu es un expert en recherche sémantique. Ta mission est de créer la meilleure stratégie de recherche JSON possible à partir des données fournies.
--- RÈGLES IMPÉRATIVES ---
1.  ANALYSE l'intention de la "Requête" et de la "Description de la section", pas seulement les mots.
2.  CIBLE les 1 ou 2 sous-classes les plus pertinentes. Sois très sélectif.
3.  REFORMULE la requête en une phrase naturelle et riche sémantiquement. Interdiction de simplement lister des mots-clés.
4.  RETOURNE uniquement le JSON, sans aucun texte avant ou après.
--- FORMAT DE SORTIE OBLIGATOIRE ---
{{
  "sous_classes_selectionnees": ["string", "..."],
  "requete_texte_reformulee": "string"
}}
--- DONNÉES EN ENTRÉE ---
Requête: "{titre_section}"
Description de la section : "{section_description}"
Labels Disponibles:
{labels_map_json}
"""

STRATEGIST_PROMPT_PROPOSALS_TEMPLATE = """
Tu es un Architecte Solutions expert. Ta mission est de générer une requête de recherche et des filtres pour trouver les propositions les plus pertinentes.
Réponds UNIQUEMENT en JSON valide, sans texte avant/après.

--- RÈGLES IMPÉRATIVES ---
1.  ANALYSE le besoin client distillé à partir de l'appel d'offres (AO).
2.  FORMULE une `requete_texte` détaillée et sémantique qui capture l'essence de ce que nous devrions chercher dans nos anciennes propositions.
3.  CHOISIS la ou les `classes` les plus pertinentes DANS LA LISTE EXACTE fournie dans `classes_disponibles`. Ne modifie pas et n'invente pas de noms de classes.
4.  Le JSON retourné doit être parfaitement valide et suivre le schéma.

--- SCHÉMA DE SORTIE OBLIGATOIRE ---
{{
  "filtres": {{ "classes": ["string", "..."] }},
  "requete_texte": "string"
}}

--- DONNÉES EN ENTRÉE ---
- Titre de la section à rédiger: "{titre_section}"
- Description de la section: "{section_description}"
- Besoin client (contexte AO distillé): {contexte_ao_distille}
- Classes disponibles pour la recherche de propositions: {classes_disponibles}

Retourne le JSON maintenant.
"""

WRITER_VALIDATOR_PROMPT_TEMPLATE = """
Tu es un rédacteur senior, expert dans la rédaction de propositions commerciales gagnantes. Ton style est clair, persuasif et orienté bénéfices client.
Réponds UNIQUEMENT en JSON valide, sans texte avant/après.

Schéma:
{{
  "status": "OK" | "CLARIFICATION_NEEDED",
  "texte_genere": string | null,
  "question": string | null,
  "manques": ["string", "..."]
}}

Brief de rédaction :
- Titre de la section: "{titre_section}"
- Description de la section: "{section_description}"
- Contexte client (de l'AO): {contexte_ao_distille}
- Exemples de solutions (de nos propositions): {resultats_recherche_propositions}

Règles IMPÉRATIVES:
1.  **NE JAMAIS COPIER LE CONTEXTE** : Tu dois SYNTHÉTISER les informations. Utilise le 'Contexte client' pour comprendre le besoin, et les 'Exemples de solutions' comme PREUVE de notre savoir-faire. Transforme ces faits en un argumentaire original et convaincant.
2.  **FOCUS ABSOLU SUR LA SECTION** : Rédige uniquement le contenu pour la section "{titre_section}". N'aborde aucun sujet qui appartient à une autre section. Sois direct et concis.
3.  **FORMAT PROFESSIONNEL** : Le texte généré DOIT être en en html  tu peut utuliser des sous titres(h3-h6) ,des paragraphes ,des tableux c'est besoin, avec css intégré pour une mieleur visualisation (couleurs...) sans changé le fond de texte .
4.  **Gestion des Manques** : Si une information critique manque pour cette section, et SEULEMENT dans ce cas, passe le statut à "CLARIFICATION_NEEDED" et pose UNE seule question précise et concise.
5.  **Objectif Final** : Le texte doit être prêt à être partagé avec le client. Chaque phrase doit renforcer l'idée que nous sommes le meilleur partenaire pour ce projet.
"""

# --- TYPES ---
class AOExcerpt(TypedDict): source: str; contenu: str; classe: str
class SearchResult(TypedDict): source_id: int; contenu: str; score: float; meta: Dict[str, Any]

# --- ADAPTATEURS D'OUTILS ---
class AdapterToolChercherAO:
    def __init__(self, doc_collection_name: str):
        self.doc_collection_name = doc_collection_name
        self.client = get_weaviate_client()

    def chercher(self, requete_texte: str, filtres: Dict) -> List[AOExcerpt]:
        print(f"--- [RECHERCHE AO] Collection: '{self.doc_collection_name}', Requête: '{requete_texte}' ---")
        if not requete_texte: return []
        sous_classes_filtres = filtres.get("classes", [])
        resultats_bruts = serache_ao(client=self.client, collection_name=self.doc_collection_name, sous_class_values=sous_classes_filtres, query_text=requete_texte, k=10)
        print(f"--- [RECHERCHE AO] {len(resultats_bruts)} résultats trouvés. ---")
        return [{"source": res.get("title", "N/A"), "contenu": res.get("contenu", ""), "classe": res.get("classe", "N/A")} for res in resultats_bruts]

class AdapterToolChercherPropositions:
    def __init__(self, prop_collection_name: str):
        self.prop_collection_name = prop_collection_name
        self.client = get_weaviate_client()

    def chercher(self, requete_texte: str, filtres: Dict) -> List[SearchResult]:
        print(f"--- [RECHERCHE PROP] Collection: '{self.prop_collection_name}', Requête: '{requete_texte}' ---")
        if not requete_texte: return []
        classes_filtres = filtres.get("classes", [])
        resultats_bruts = serch_pro(client=self.client, collection_name=self.prop_collection_name, class_values=classes_filtres, query_text=requete_texte, k=5)
        print(f"--- [RECHERCHE PROP] {len(resultats_bruts)} résultats trouvés. ---")
        results = []
        for i, res in enumerate(resultats_bruts):
            distance = res.get("_meta", {}).get("distance", 1.0)
            score = max(0.0, 1.0 - distance)
            results.append({"source_id": i, "contenu": res.get("content", ""), "score": score, "meta": {"title": res.get("title", ""), "classe": res.get("classes", ""), "distance_weaviate": distance}})
        return results

# --- INTERFACE FRONTEND ---
class MockFrontendInterface:
    def send(self, event: str, payload: Dict):
        print(f"\n>>> [Frontend Event: {event}]\n{json.dumps(payload, indent=2, ensure_ascii=False)}")

# --- UTILITAIRE JSON ---
def parse_llm_json(call_llm, prompt: str, schema_keys: Optional[List[str]] = None, max_retries: int = 3) -> Dict[str, Any]:
    last_err = None
    for attempt in range(max_retries):
        raw = (call_llm(prompt) or "").strip()
        cleaned = re.sub(r"^\s*```json\s*|\s*```\s*$", "", raw, flags=re.IGNORECASE | re.MULTILINE).strip()
        try:
            data = json.loads(cleaned)
            if schema_keys and not all(k in data for k in schema_keys):
                raise ValueError(f"Clés manquantes dans le JSON: {', '.join(k for k in schema_keys if k not in data)}")
            return data
        except Exception as e:
            last_err = e
            print(f"Tentative {attempt + 1} d'analyse JSON échouée: {e}")
            time.sleep(0.5)
    raise ValueError(f"Échec de l'analyse du JSON du LLM après {max_retries} essais: {last_err}")


# ==============================================================================
# SECTION 2 : DÉFINITION DU GRAPHE DE GÉNÉRATION AVEC LANGGRAPH
# ==============================================================================

class GraphState(TypedDict):
    titre_section: str
    description_section: str
    labels_map_ao: Dict[str, List[str]]
    available_classes_prop: List[str]
    strategie_ao: Dict
    contexte_ao_distille: List[AOExcerpt]
    strategie_prop: Dict
    resultats_recherche_propositions: List[SearchResult]
    texte_genere: Optional[str]
    question_ia: Optional[str]
    status_redaction: Optional[Literal["OK", "CLARIFICATION_NEEDED"]]

class GraphRunner:
    def __init__(self, llm_client: BaseChatModel, chercher_ao_tool: AdapterToolChercherAO, chercher_prop_tool: AdapterToolChercherPropositions):
        self.llm = llm_client
        self.chercher_ao_tool = chercher_ao_tool
        self.chercher_prop_tool = chercher_prop_tool
        
    def _execute_prompt(self, prompt: str) -> str:
        try:
            print(f"--- [GraphRunner] Envoi du prompt au LLM (taille: {len(prompt)} caractères)... ---")
            response = self.llm.invoke(prompt)
            print("--- [GraphRunner] Réponse reçue du LLM. ---")
            return response.content
        except Exception as e:
            print(f"!!!!!!!!!!!!!!! ERREUR API LLM: {e} !!!!!!!!!!!!!!!")
            traceback.print_exc()
            return json.dumps({"status": "CLARIFICATION_NEEDED", "question": f"Erreur de communication avec l'IA: {e}", "texte_genere": None, "manques": ["connexion_ia"]})

    def determine_strategie_ao(self, state: GraphState) -> Dict:
        print(f"\n[Node] Détermination de la Stratégie AO pour '{state['titre_section']}'")
        prompt = STRATEGIST_PROMPT_AO_TEMPLATE.format(
            titre_section=state['titre_section'],
            section_description=state['description_section'],
            labels_map_json=json.dumps(state['labels_map_ao'], ensure_ascii=False, indent=2)
        )
        result = parse_llm_json(self._execute_prompt, prompt, schema_keys=["sous_classes_selectionnees", "requete_texte_reformulee"])
        return {"strategie_ao": result}

    def recherche_ao(self, state: GraphState) -> Dict:
        print(f"[Node] Exécution de la Recherche AO")
        strategie = state['strategie_ao']
        requete = strategie.get("requete_texte_reformulee", "")
        filtres = {"classes": strategie.get("sous_classes_selectionnees", [])}
        contexte = self.chercher_ao_tool.chercher(requete_texte=requete, filtres=filtres)
        return {"contexte_ao_distille": contexte}

    def determine_strategie_prop(self, state: GraphState) -> Dict:
        print(f"[Node] Détermination de la Stratégie Propositions")
        prompt = STRATEGIST_PROMPT_PROPOSALS_TEMPLATE.format(
            titre_section=state['titre_section'],
            section_description=state['description_section'],
            contexte_ao_distille=json.dumps(state["contexte_ao_distille"], ensure_ascii=False),
            classes_disponibles=json.dumps(state["available_classes_prop"], ensure_ascii=False)
        )
        result = parse_llm_json(self._execute_prompt, prompt, schema_keys=["filtres", "requete_texte"])
        return {"strategie_prop": result}

    def recherche_prop(self, state: GraphState) -> Dict:
        print(f"[Node] Exécution de la Recherche Propositions")
        strategie = state['strategie_prop']
        requete = strategie.get("requete_texte", "")
        filtres = strategie.get("filtres", {})
        resultats = self.chercher_prop_tool.chercher(requete_texte=requete, filtres=filtres)
        return {"resultats_recherche_propositions": resultats}

    def appeler_redacteur_validateur(self, state: GraphState) -> Dict:
        print(f"[Node] Appel du Rédacteur/Validateur")
        prompt = WRITER_VALIDATOR_PROMPT_TEMPLATE.format(
            titre_section=state['titre_section'],
            section_description=state['description_section'],
            contexte_ao_distille=json.dumps(state["contexte_ao_distille"], ensure_ascii=False),
            resultats_recherche_propositions=json.dumps(state["resultats_recherche_propositions"], ensure_ascii=False)
        )
        res = parse_llm_json(self._execute_prompt, prompt, schema_keys=["status"])
        return {
            "status_redaction": res.get("status"),
            "texte_genere": res.get("texte_genere"),
            "question_ia": res.get("question")
        }

    def decider_apres_redaction(self, state: GraphState) -> Literal["terminer", "demander_clarification"]:
        print(f"[Router] Décision après rédaction. Statut: {state['status_redaction']}")
        return "terminer" if state['status_redaction'] == "OK" else "demander_clarification"

def create_generation_graph(doc_collection_name: str, prop_collection_name: str, llm_client: BaseChatModel) -> Any:
    """Construit et compile le graphe LangGraph."""
    ao_tool = AdapterToolChercherAO(doc_collection_name)
    prop_tool = AdapterToolChercherPropositions(prop_collection_name)
    runner = GraphRunner(llm_client, ao_tool, prop_tool)
    
    graph = StateGraph(GraphState)

    graph.add_node("strategie_ao", runner.determine_strategie_ao)
    graph.add_node("recherche_ao", runner.recherche_ao)
    graph.add_node("strategie_prop", runner.determine_strategie_prop)
    graph.add_node("recherche_prop", runner.recherche_prop)
    graph.add_node("redacteur_validateur", runner.appeler_redacteur_validateur)

    graph.set_entry_point("strategie_ao")
    graph.add_edge("strategie_ao", "recherche_ao")
    graph.add_edge("recherche_ao", "strategie_prop")
    graph.add_edge("strategie_prop", "recherche_prop")
    graph.add_edge("recherche_prop", "redacteur_validateur")
    
    graph.add_conditional_edges(
        "redacteur_validateur",
        runner.decider_apres_redaction,
        {"terminer": END, "demander_clarification": END}
    )
    
    return graph.compile(checkpointer=MemorySaver())

# ==============================================================================
# SECTION 3 : ORCHESTRATEUR PRINCIPAL UTILISANT LE GRAPHE
# ==============================================================================

class OrchestrateurLangGraph:
    def __init__(self, template: Dict, labels_map_ao: Dict, available_classes_prop: List[str], frontend: Any, user_email: str, user_settings: dict):
        if not user_email:
            raise ValueError("L'email de l'utilisateur est requis.")
        if not user_settings or not user_settings.get('api_key'):
             raise ValueError("Les paramètres utilisateur (user_settings) avec 'api_key' sont requis.")

        self.user_email = user_email
        self.frontend = frontend
        self.template_structure = template.get("sections", [])
        self.settings = user_settings
        
        self.doc_collection_name = _sanitize_email_for_collection_name(user_email, "Doc")
        self.prop_collection_name = _sanitize_email_for_collection_name(user_email, "Prop")

        print(f"--- [Orchestrateur] Initialisation pour {user_email}. Collections: '{self.doc_collection_name}', '{self.prop_collection_name}' ---")

        self.llm_client = self._initialize_llm()

        self.graph = create_generation_graph(self.doc_collection_name, self.prop_collection_name, self.llm_client)
        self.dossiers_sections = self._initialiser_dossiers(labels_map_ao, available_classes_prop)

    def _initialize_llm(self) -> BaseChatModel:
        platform = self.settings.get("platform", "google")
        api_key = self.settings.get("api_key")
        model = self.settings.get("model", "gemini-1.5-flash")
        temperature = self.settings.get("temperature", 0.7)
        max_tokens = self.settings.get("max_tokens", 2048)

        if not api_key:
            raise ValueError("La clé API est manquante dans les paramètres de l'utilisateur.")

        print(f"--- [Orchestrateur] Initialisation du LLM : Plateforme='{platform}', Modèle='{model}' ---")

        if platform == "openrouter":
            return ChatOpenAI(model=model, temperature=temperature, max_tokens=max_tokens, openai_api_key=api_key, openai_api_base="https://openrouter.ai/api/v1", default_headers={"HTTP-Referer": "http://localhost:3000", "X-Title": "Orchestrateur RFP Datadictos"})
        elif platform == "google":
            return ChatGoogleGenerativeAI(model=model, google_api_key=api_key, temperature=temperature, max_output_tokens=max_tokens, convert_system_message_to_human=True)
        else:
            raise ValueError(f"La plateforme '{platform}' n'est pas supportée.")

    def _initialiser_dossiers(self, labels_map_ao, available_classes_prop) -> Dict:
        dossiers = {}
        for section_obj in self.template_structure:
            titre = section_obj.get("name")
            if titre:
                dossiers[titre] = {"statut": "a_faire", "graph_input": {"titre_section": titre, "description_section": section_obj.get("content", ""), "labels_map_ao": labels_map_ao, "available_classes_prop": available_classes_prop,}, "thread_id": str(uuid.uuid4()), "versions_generees": [],}
        print("[Orchestrateur] Mémoire initialisée pour toutes les sections.")
        return dossiers

    def _run_graph_for_section(self, titre: str):
        dossier = self.dossiers_sections[titre]
        dossier["statut"] = "en_cours"
        config = {"configurable": {"thread_id": dossier["thread_id"]}}
        final_state = self.graph.invoke(dossier["graph_input"], config)
        if final_state['status_redaction'] == "OK":
            texte = final_state.get("texte_genere", "")
            dossier["statut"] = "valide"
            dossier["versions_generees"].append(texte)
            self.frontend.send("nouvelle_version_section", {"titre": titre, "contenu": texte})
            print(f"--- Section '{titre}' terminée avec succès. ---")
        else:
            dossier["statut"] = "en_attente_feedback"
            question = final_state.get("question_ia", "Clarification nécessaire.")
            self.frontend.send("attente_feedback_utilisateur", {"titre": titre, "question": question})
            print(f"--- Section '{titre}' mise en pause. En attente de feedback. ---")

    def demarrer_generation(self):
        self.frontend.send("statut_generation", {"message": "Démarrage de la génération..."})
        for titre in self.dossiers_sections:
            if self.dossiers_sections[titre]["statut"] == "a_faire":
                try:
                    self._run_graph_for_section(titre)
                except Exception as e:
                    print(f"!!!!!!!!!!!!!!! ERREUR CRITIQUE DANS LE GRAPHE POUR LA SECTION '{titre}': {e} !!!!!!!!!!!!!!!")
                    traceback.print_exc()
                    self.frontend.send("error", {"titre": titre, "message": f"Erreur critique: {e}"})
                    self.dossiers_sections[titre]['statut'] = 'erreur'

        if all(d["statut"] in ["valide", "erreur"] for d in self.dossiers_sections.values()):
             self.frontend.send("generation_complete", {"message": ""})
    
    def gerer_message_utilisateur(self, message: str, section_cible: str):
        dossier = self.dossiers_sections.get(section_cible)
        if not dossier or dossier["statut"] != "en_attente_feedback":
            print(f"AVERTISSEMENT: Message reçu pour la section '{section_cible}' qui n'est pas en attente.")
            return
        self.frontend.send("statut_generation", {"message": f"Merci. Reprise de la rédaction pour '{section_cible}'..."})
        dossier["graph_input"]["description_section"] += f"\n\nClarification de l'utilisateur: {message}"
        self._run_graph_for_section(section_cible)

    def finaliser_et_recuperer_contenu(self) -> dict[str, str]:
        print("[Orchestrateur] Préparation du contenu final pour la conversation...")
        base_de_connaissance = {}
        for titre, data in self.dossiers_sections.items():
            if data["statut"] == "valide" and data["versions_generees"]:
                base_de_connaissance[titre] = data["versions_generees"][-1]
        
        if not base_de_connaissance:
            print("[Orchestrateur] AVERTISSEMENT: Aucune section n'a été validée. La base de connaissance est vide.")

        return base_de_connaissance