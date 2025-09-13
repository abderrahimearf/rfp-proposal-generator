# backend/services/agents/conversation_manager.py
# -- coding: utf-8 --

from __future__ import annotations
from typing import Dict, List, Any
import traceback
import base64
import os
import re

# --- Imports pour la recherche sémantique ---
import weaviate
from weaviate.auth import AuthApiKey
from sentence_transformers import SentenceTransformer

# --- Imports LangChain & LLM ---
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.language_models.chat_models import BaseChatModel
from langchain.tools import tool
from langchain.memory import ConversationBufferMemory
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import AgentExecutor, create_openai_tools_agent

# --- CONFIGURATION DE LA RECHERCHE ---
WEAVIATE_URL = os.getenv("WEAVIATE_URL")
WEAVIATE_API_KEY = os.getenv("WEAVIATE_API_KEY")
EMBED_MODEL_NAME = "intfloat/multilingual-e5-small"
_MODEL_EMB = None

def _get_embedding_model():
    """Charge le modèle d'embedding une seule fois pour de meilleures performances."""
    global _MODEL_EMB
    if _MODEL_EMB is None:
        print(f"Chargement du modèle d'embedding '{EMBED_MODEL_NAME}'...")
        _MODEL_EMB = SentenceTransformer(EMBED_MODEL_NAME)
    return _MODEL_EMB

# AJOUTÉ : La fonction de nettoyage d'email, identique à celle des services de stockage
def _sanitize_email_for_collection_name(email: str, suffix: str) -> str:
    """Nettoie un email pour en faire un nom de collection Weaviate valide et ajoute un suffixe."""
    sanitized = re.sub(r'[^a-zA-Z0-9]', '', email)
    if not sanitized:
        raise ValueError("L'email fourni est invalide après nettoyage.")
    return sanitized.capitalize() + suffix

class ConversationManager:
    """
    Gère un agent conversationnel de recherche et de conseil.
    Il répond aux questions en se basant sur les documents de l'utilisateur indexés dans Weaviate.
    """
    # MODIFIÉ : Le constructeur accepte user_email au lieu de user_id
    def __init__(self, user_settings: dict, user_email: str):
        if not user_settings or not user_settings.get('api_key'):
            raise ValueError("Les paramètres utilisateur (user_settings) avec 'api_key' sont requis.")
        if not user_email:
            raise ValueError("L'email de l'utilisateur ('user_email') est requis.")
            
        self.settings = user_settings
        self.user_email = user_email  # L'agent sait pour quel utilisateur il travaille
        
        self.agent_executor = self._initialiser_agent()
        print(f"[ConversationManager] Agent de recherche initialisé pour l'utilisateur '{self.user_email}'.")

    def _initialize_llm(self) -> BaseChatModel:
        """Initialise le bon client LLM."""
        platform = self.settings.get("platform", "google")
        api_key = self.settings.get("api_key")
        model = self.settings.get("model", "gemini-1.5-flash")
        temperature = self.settings.get("temperature", 0.7)
        max_tokens = self.settings.get("max_tokens", 2048)

        if not api_key:
            raise ValueError("La clé API est manquante dans les paramètres de l'utilisateur.")

        if platform == "openrouter":
            return ChatOpenAI(model=model, temperature=temperature, max_tokens=max_tokens, openai_api_key=api_key, openai_api_base="https://openrouter.ai/api/v1", default_headers={"HTTP-Referer": "http://localhost:3000", "X-Title": "Assistant RFP Datadictos"})
        elif platform == "google":
            return ChatGoogleGenerativeAI(model=model, google_api_key=api_key, temperature=temperature, max_output_tokens=max_tokens, convert_system_message_to_human=True)
        else:
            raise ValueError(f"La plateforme '{platform}' n'est pas supportée.")

    def get_initial_message(self) -> str:
        return "Bonjour ! Je suis votre consultant de projet. Posez-moi des questions sur l'appel d'offres ou sur vos propositions passées pour préparer votre stratégie de réponse."

    def _creer_outils(self) -> List[Any]:
        @tool
        def rechercher_dans_appel_offre(question: str) -> str:
            """
            OBLIGATOIRE pour répondre aux questions sur les exigences, le contexte ou tout autre détail de l'appel d'offres actuel de l'utilisateur.
            """
            try:
                # MODIFIÉ : Utilise l'email de l'utilisateur pour construire le nom de la collection
                collection_name = _sanitize_email_for_collection_name(self.user_email, "Doc")
                with weaviate.connect_to_weaviate_cloud(cluster_url=WEAVIATE_URL, auth_credentials=AuthApiKey(WEAVIATE_API_KEY)) as client:
                    if not client.collections.exists(collection_name):
                        return "Information : Aucun appel d'offres n'a encore été indexé. Je ne peux donc pas y faire de recherche."
                    
                    collection = client.collections.get(collection_name)
                    model = _get_embedding_model()
                    query_vector = model.encode(f"query: {question}").tolist()
                    
                    response = collection.query.near_vector(near_vector=query_vector, limit=3, return_properties=["title", "contenu"])
                    
                    if not response.objects:
                        return "Je n'ai rien trouvé de pertinent dans l'appel d'offres à ce sujet."

                    results = [f"- Extrait de la section '{obj.properties['title']}':\n{obj.properties['contenu']}" for obj in response.objects]
                    return "Voici ce que j'ai trouvé dans l'appel d'offres :\n\n" + "\n\n".join(results)
            except Exception as e:
                return f"Erreur technique lors de la recherche : {e}"

        @tool
        def rechercher_dans_propositions_existantes(question: str) -> str:
            """
            OBLIGATOIRE pour trouver des exemples, des formulations ou des sections pertinentes dans les anciennes propositions commerciales de l'utilisateur.
            """
            try:
                # MODIFIÉ : Utilise l'email de l'utilisateur pour construire le nom de la collection
                collection_name = _sanitize_email_for_collection_name(self.user_email, "Prop")
                with weaviate.connect_to_weaviate_cloud(cluster_url=WEAVIATE_URL, auth_credentials=AuthApiKey(WEAVIATE_API_KEY)) as client:
                    if not client.collections.exists(collection_name):
                        return "Information : Aucune ancienne proposition n'a encore été indexée. Je ne peux donc pas y chercher d'exemples."

                    collection = client.collections.get(collection_name)
                    model = _get_embedding_model()
                    query_vector = model.encode(f"passage: {question}").tolist()

                    response = collection.query.near_vector(near_vector=query_vector, limit=3, return_properties=["title", "contenu"])

                    if not response.objects:
                        return "Je n'ai rien trouvé d'exemple pertinent dans vos anciennes propositions."
                    
                    results = [f"- Extrait de la section '{obj.properties['title']}':\n{obj.properties['contenu']}" for obj in response.objects]
                    return "Voici des exemples tirés de vos anciennes propositions :\n\n" + "\n\n".join(results)
            except Exception as e:
                return f"Erreur technique lors de la recherche : {e}"
        
        return [rechercher_dans_appel_offre, rechercher_dans_propositions_existantes]

    def _initialiser_agent(self) -> AgentExecutor:
        tools = self._creer_outils()
        
        memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)
        memory.chat_memory.add_ai_message(self.get_initial_message())
        
        system_prompt = """
        Tu es un consultant expert en stratégie de réponse aux appels d'offres.
        Ton unique rôle est de répondre aux questions de l'utilisateur en cherchant des informations dans ses documents personnels.
        - Pour les questions sur le cahier des charges, utilise OBLIGATOIREMENT l'outil `rechercher_dans_appel_offre`.
        - Pour trouver des exemples dans d'anciens travaux, utilise OBLIGATOIREMENT l'outil `rechercher_dans_propositions_existantes`.
        
        NE PAS inventer de réponses. Si tes outils ne trouvent rien, dis-le clairement.
        Tu n'as PAS la capacité de créer ou de modifier un document. Tu es un expert en recherche et conseil uniquement.
        """
        
        prompt = ChatPromptTemplate.from_messages([("system", system_prompt), MessagesPlaceholder(variable_name="chat_history"), ("human", "{input}"), MessagesPlaceholder(variable_name="agent_scratchpad")])
        llm = self._initialize_llm()
        agent = create_openai_tools_agent(llm, tools, prompt)
        
        return AgentExecutor(agent=agent, tools=tools, memory=memory, verbose=True, handle_parsing_errors=True)

    def discuter(self, user_input: str, image_file=None) -> dict:
        message_content = [{"type": "text", "text": user_input}]
        if image_file:
            # ... (logique de gestion de l'image)
            pass
        try:
            response = self.agent_executor.invoke({"input": message_content})
            return {"output": response.get("output", "Désolé, je n'ai pas pu générer de réponse.")}
        except Exception as e:
            traceback.print_exc()
            return {"output": f"Désolé, une erreur technique est survenue. Détail: {str(e)}"}