# backend/backend/services/agents/tools.py
# -*- coding: utf-8 -*-
from __future__ import annotations

from typing import List, Dict, Any, Optional
import os
import json
from pathlib import Path

import weaviate
from weaviate.auth import AuthApiKey
from weaviate.classes.query import Filter
from weaviate.exceptions import WeaviateQueryError # Important pour la gestion d'erreur
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

# Charger les variables d'environnement (WEAVIATE_URL, WEAVIATE_API_KEY, etc.)
load_dotenv()

# =============================================================================
# Config
# =============================================================================
DEFAULT_EMBED_MODEL = os.getenv("EMBED_MODEL", "intfloat/multilingual-e5-small")
DEFAULT_EMBED_DEVICE = os.getenv("EMBED_DEVICE")
DEFAULT_LABELS_JSON = r"C:\Users\DHM\Downloads\projet\backend\backend\services\sections-label.json"

# =============================================================================
# GESTION DES CLIENTS (MIS EN CACHE)
# =============================================================================
_WEAVIATE_CLIENT: Optional[weaviate.WeaviateClient] = None
_EMBEDDER: Optional[SentenceTransformer] = None

def get_weaviate_client() -> weaviate.WeaviateClient:
    """
    Gère une connexion unique et mise en cache au CLOUD Weaviate.
    Récupère les identifiants depuis les variables d'environnement.
    """
    global _WEAVIATE_CLIENT
    if _WEAVIATE_CLIENT is None or not _WEAVIATE_CLIENT.is_connected():
        weaviate_url = os.getenv("WEAVIATE_URL")
        weaviate_api_key = os.getenv("WEAVIATE_API_KEY")
        if not weaviate_url or not weaviate_api_key:
            raise ValueError("Les variables d'environnement WEAVIATE_URL et WEAVIATE_API_KEY doivent être définies.")
        
        print("--- [TOOLS] Connexion au Weaviate Cloud... ---")
        _WEAVIATE_CLIENT = weaviate.connect_to_weaviate_cloud(
            cluster_url=weaviate_url,
            auth_credentials=AuthApiKey(api_key=weaviate_api_key),
        )
        print("--- [TOOLS] Connecté avec succès à Weaviate Cloud. ---")
    return _WEAVIATE_CLIENT

def _get_embedder() -> SentenceTransformer:
    """Retourne un SentenceTransformer mis en cache."""
    global _EMBEDDER
    if _EMBEDDER is None:
        print(f"--- [TOOLS] Chargement du modèle d'embedding '{DEFAULT_EMBED_MODEL}'... ---")
        _EMBEDDER = SentenceTransformer(DEFAULT_EMBED_MODEL, device=DEFAULT_EMBED_DEVICE)
        print("--- [TOOLS] Modèle d'embedding chargé. ---")
    return _EMBEDDER

# =============================================================================
# FONCTIONS DE RECHERCHE (ADAPTÉES POUR LE MULTI-TENANCY)
# =============================================================================
def _or_chain(prop: str, values: List[str]) -> Optional[Filter]:
    """
    CORRIGÉ: Construit un filtre "OU" chaîné en utilisant la syntaxe correcte.
    Exemple: (prop == v1) OR (prop == v2) ...
    """
    # Nettoie la liste pour ne garder que les chaînes non vides
    vals = [str(v) for v in values if v]
    if not vals:
        return None

    # Crée une liste de filtres individuels (un pour chaque valeur)
    filters = [Filter.by_property(prop).equal(v) for v in vals]
    
    # S'il n'y a qu'un seul filtre, pas besoin de le chaîner
    if len(filters) == 1:
        return filters[0]
        
    # S'il y a plusieurs filtres, on les combine avec l'opérateur OR (|)
    final_filter = filters[0]
    for i in range(1, len(filters)):
        final_filter = final_filter | filters[i]
        
    return final_filter

def serache_ao(
    client: weaviate.WeaviateClient,
    collection_name: str,
    sous_class_values: List[str],
    query_text: str,
    k: int = 10,
) -> List[Dict[str, Any]]:
    """Recherche hybride dans la collection de documents ('Doc') d'un utilisateur."""
    if not collection_name:
        raise ValueError("Le nom de la collection 'Doc' est requis.")
    
    try:
        col = client.collections.get(collection_name)
        embedder = _get_embedder()
        
        qvec = embedder.encode(query_text, normalize_embeddings=True).tolist()
        
        # CORRECTION LOGIQUE : On filtre sur la propriété 'classe' et non 'sous_classe'.
        filt = _or_chain("classe", sous_class_values or [])

        # LOG DE DÉBOGAGE : Affiche le filtre qui sera appliqué.
        print(f"--- [TOOLS - AO FILTER] Filtre appliqué sur la CLASSE: {filt if filt else 'Aucun'} ---")

        res = col.query.hybrid(
            query=query_text,
            vector=qvec,
            alpha=0.5,
            limit=int(k),
            filters=filt,
            return_properties=["title", "contenu", "classe", "sous_classe"],
        )
        return [obj.properties for obj in res.objects]
        
    except WeaviateQueryError as e:
        # GESTION D'ERREUR : Empêche le crash si la collection n'existe pas.
        if "could not find class" in str(e).lower():
            print(f"--- [TOOLS - AVERTISSEMENT] La collection '{collection_name}' n'existe pas. Retour de 0 résultat. ---")
            return []
        else:
            # Laisse les autres erreurs de requête planter pour les voir.
            raise e

def serch_pro(
    client: weaviate.WeaviateClient,
    collection_name: str,
    class_values: List[str],
    query_text: str,
    k: int = 5,
) -> List[Dict[str, Any]]:
    """Recherche sémantique dans la collection de propositions ('Prop') d'un utilisateur."""
    if not collection_name:
        raise ValueError("Le nom de la collection 'Prop' est requis.")

    try:
        col = client.collections.get(collection_name)
        embedder = _get_embedder()

        qvec = embedder.encode(query_text, normalize_embeddings=True).tolist()
        filt = _or_chain("classe", class_values or [])

        # LOG DE DÉBOGAGE : Affiche le filtre qui sera appliqué.
        print(f"--- [TOOLS - PROP FILTER] Filtre appliqué sur la CLASSE: {filt if filt else 'Aucun'} ---")
        
        res = col.query.near_vector(
            near_vector=qvec,
            limit=int(k),
            filters=filt,
            return_metadata=["distance"],
            return_properties=["title", "contenu", "classe"],
        )

        hits = []
        for obj in res.objects:
            hit = obj.properties
            hit['content'] = hit.pop('contenu', '') 
            hit['classes'] = hit.pop('classe', '')
            hit['_meta'] = {"distance": obj.metadata.distance} if obj.metadata else {}
            hits.append(hit)
        return hits
    
    except WeaviateQueryError as e:
        # GESTION D'ERREUR : Empêche le crash si la collection n'existe pas.
        if "could not find class" in str(e).lower():
            print(f"--- [TOOLS - AVERTISSEMENT] La collection '{collection_name}' n'existe pas. Retour de 0 résultat. ---")
            return []
        else:
            raise e

# =============================================================================
# Outils labels (list_sections / list_subsections) depuis un JSON local
# =============================================================================
__LABELS_CACHE: Optional[Dict[str, List[str]]] = None
__LABELS_MTIME: Optional[float] = None

def _load_labels(path: str = DEFAULT_LABELS_JSON, force: bool = False) -> Dict[str, List[str]]:
    global __LABELS_CACHE, __LABELS_MTIME
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Fichier labels introuvable: {path}")
    mtime = p.stat().st_mtime
    if force or __LABELS_CACHE is None or __LABELS_MTIME != mtime:
        with p.open("r", encoding="utf-8") as f:
            __LABELS_CACHE = json.load(f)
        __LABELS_MTIME = mtime
    return __LABELS_CACHE

def list_sections(path: str = DEFAULT_LABELS_JSON) -> List[str]:
    labels = _load_labels(path)
    return sorted(labels.keys())

def list_subsections(classe: str, path: str = DEFAULT_LABELS_JSON, strict: bool = False) -> List[str]:
    if not isinstance(classe, str) or not classe.strip():
        if strict: raise ValueError("Paramètre 'classe' vide ou invalide.")
        return []
    labels = _load_labels(path)
    subs = labels.get(classe.strip())
    if subs is None:
        if strict: raise ValueError(f"Classe inconnue: {classe}")
        return []
    return list(subs)