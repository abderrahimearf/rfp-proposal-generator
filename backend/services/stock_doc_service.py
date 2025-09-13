# services/stock_doc_service.py
# -*- coding: utf-8 -*-
import os
import uuid
import re
import warnings
from pathlib import Path
from typing import List, Dict, Tuple

import weaviate
from weaviate.auth import AuthApiKey
from weaviate.classes.config import Property, DataType, Configure
from weaviate.collections.classes.data import DataObject
from sentence_transformers import SentenceTransformer
from joblib import load
from dotenv import load_dotenv

from docling.document_converter import DocumentConverter
from config import Config

# --- CONFIG & CACHES ---
load_dotenv()
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)

_SVM_MODEL_PATH_DEFAULT = "services/models/svm_sections_hier.joblib"
_SVM_MODEL_PATH = getattr(Config, "SVM_MODEL_PATH", _SVM_MODEL_PATH_DEFAULT)

_MODEL_EMB: SentenceTransformer | None = None
_MODEL_CLS_ARTIFACT = None

def _sanitize_email_for_collection_name(email: str) -> str:
    """Nettoie un email pour en faire un nom de collection Weaviate valide et ajoute le suffixe 'Doc'."""
    sanitized = re.sub(r'[^a-zA-Z0-9]', '', email)
    if not sanitized:
        raise ValueError("L'email fourni est invalide après nettoyage.")
    return sanitized.capitalize() + "Doc"

# --- TRAITEMENT DOCUMENT (Docling → Markdown → Sections) ---
_HEADING_RE = re.compile(r"^(#{1,6})\s*(.+?)\s*$", re.MULTILINE)

def _docling_to_markdown(file_path: str) -> str:
    conv = DocumentConverter()
    res = conv.convert(file_path)
    return res.document.export_to_markdown()

def _slice_sections(md_text: str) -> List[Dict]:
    headings = [(m.start(), len(m.group(1)), m.group(2).strip()) for m in _HEADING_RE.finditer(md_text)]
    if not headings:
        return [{"title": "DOCUMENT", "level": 0, "content": md_text.strip()}]
    
    sections = []
    for i, (pos, level, title) in enumerate(headings):
        line_end = md_text.find("\n", pos)
        content_start = len(md_text) if line_end == -1 else line_end + 1
        end_pos = len(md_text)
        for j in range(i + 1, len(headings)):
            if headings[j][1] <= level:
                end_pos = headings[j][0]
                break
        sections.append({"title": title, "content": md_text[content_start:end_pos].strip()})
    return sections

def docling_sections(file_path: str) -> List[Dict[str, str]]:
    md = _docling_to_markdown(file_path)
    return [sec for sec in _slice_sections(md) if (sec.get("content") or "").strip()]

# --- CLASSIFICATION (Chargement + Prédiction) ---
def _resolve_svm_path() -> str:
    p = Path(_SVM_MODEL_PATH)
    if p.exists():
        return str(p)
    cand = Path(__file__).resolve().parent.parent / _SVM_MODEL_PATH
    if cand.exists():
        return str(cand)
    raise FileNotFoundError(f"Modèle SVM introuvable: {_SVM_MODEL_PATH}")

def _get_classifier():
    global _MODEL_CLS_ARTIFACT
    if _MODEL_CLS_ARTIFACT is None:
        path = _resolve_svm_path()
        _MODEL_CLS_ARTIFACT = load(path)
    model = _MODEL_CLS_ARTIFACT.get("model") if isinstance(_MODEL_CLS_ARTIFACT, dict) else _MODEL_CLS_ARTIFACT
    mapping = _MODEL_CLS_ARTIFACT.get("mapping_class_to_subclasses", {}) if isinstance(_MODEL_CLS_ARTIFACT, dict) else {}
    return model, mapping

def predict_labels_batch(titles: List[str], contenus: List[str]) -> List[Tuple[str, str]]:
    assert len(titles) == len(contenus)
    model, mapping = _get_classifier()
    X = [f"{t}\n{c}" for t, c in zip(titles, contenus)]
    Y = model.predict(X)
    out = []
    for pred_cl, pred_sc in Y:
        cl, sc = str(pred_cl), str(pred_sc)
        allowed = set(mapping.get(cl, []))
        if allowed and sc not in allowed:
            sc = sorted(list(allowed))[0]
        out.append((cl, sc))
    return out

# --- WEAVIATE (Schéma, Embedding, Ingestion) ---
def _get_embedding_model() -> SentenceTransformer:
    global _MODEL_EMB
    if _MODEL_EMB is None:
        device = getattr(Config, "EMBED_DEVICE", None)
        model_name = getattr(Config, "EMBED_MODEL", "intfloat/multilingual-e5-small")
        print(f"Chargement du modèle d'embedding '{model_name}' (device={device or 'auto'})...")
        _MODEL_EMB = SentenceTransformer(model_name_or_path=model_name, device=device)
    return _MODEL_EMB

def recreate_doc_collection(client: weaviate.WeaviateClient, collection_name: str):
    """(Ré)initialise la collection : supprime si existante, puis la crée."""
    if client.collections.exists(collection_name):
        print(f"La collection '{collection_name}' existe. Suppression...")
        client.collections.delete(collection_name)
        print(f"Collection '{collection_name}' supprimée.")

    print(f"Création de la collection '{collection_name}'...")
    props = [
        Property(name="title",       data_type=DataType.TEXT),
        Property(name="contenu",     data_type=DataType.TEXT),
        Property(name="classe",      data_type=DataType.TEXT),
        Property(name="sous_classe", data_type=DataType.TEXT),
    ]
    client.collections.create(
        name=collection_name,
        description=f"Sections de documents pour la collection {collection_name}.",
        properties=props,
        vectorizer_config=Configure.Vectorizer.none(),
    )
    print(f"Collection '{collection_name}' créée avec succès.")

def upload_doc_sections_to_weaviate(client: weaviate.WeaviateClient, file_path: str, embedding_model: SentenceTransformer, collection_name: str):
    doc_col = client.collections.get(collection_name)
    sections = docling_sections(file_path)
    if not sections:
        return 0

    titles = [s.get("title", "") for s in sections]
    contents = [s.get("contenu", "") for s in sections]

    print("Classification des sections...")
    labels = predict_labels_batch(titles, contents)

    print("Calcul des embeddings...")
    model_name = getattr(Config, "EMBED_MODEL", "")
    prefix = "passage: " if "e5" in model_name.lower() else ""
    texts_for_vec = [f"{prefix}{t}\n\n{c}" for t, c in zip(titles, contents)]
    batch_size = int(getattr(Config, "EMBED_BATCH_SIZE", 32))

    vecs = embedding_model.encode(
        texts_for_vec,
        batch_size=batch_size,
        normalize_embeddings=True,
        show_progress_bar=True
    )

    print(f"Insertion des données dans Weaviate ('{collection_name}')...")
    src_name = Path(file_path).name
    with doc_col.batch.dynamic() as batch:
        for i, (title, cont, (classe, sous_classe), vec) in enumerate(zip(titles, contents, labels, vecs)):
            uid = uuid.uuid5(uuid.NAMESPACE_URL, f"{src_name}|{collection_name}|{i}|{title[:64]}")
            properties = {
                "title": title,
                "contenu": cont,
                "classe": classe,
                "sous_classe": sous_classe,
            }
            batch.add_object(properties=properties, uuid=uid, vector=vec.tolist())
    
    print(f"{len(sections)} sections ajoutées à la collection '{collection_name}'.")
    return len(sections)

def save_and_index_document(file_storage, user_email: str):
    """
    Fonction principale : traite un fichier et l'indexe dans une collection Weaviate Cloud
    dédiée à l'utilisateur, en remplaçant systématiquement les données précédentes.
    """
    if not user_email:
        raise ValueError("L'email de l'utilisateur est requis pour l'indexation.")

    weaviate_url = os.getenv("WEAVIATE_URL") or getattr(Config, "WEAVIATE_URL", None)
    weaviate_api_key = os.getenv("WEAVIATE_API_KEY") or getattr(Config, "WEAVIATE_API_KEY", None)
    if not weaviate_url or not weaviate_api_key:
        raise ValueError("WEAVIATE_URL et WEAVIATE_API_KEY doivent être définis.")

    client = None
    try:
        collection_name = _sanitize_email_for_collection_name(user_email)

        print(f"Connexion au cluster Weaviate Cloud : {weaviate_url}")
        client = weaviate.connect_to_weaviate_cloud(
            cluster_url=weaviate_url,
            auth_credentials=AuthApiKey(api_key=weaviate_api_key),
        )
        if not client.is_ready():
            raise ConnectionError("Connexion à Weaviate Cloud échouée.")

        # Étape cruciale : suppression de l'ancienne collection et recréation
        recreate_doc_collection(client, collection_name)

        tmp_dir = getattr(Config, "TMP_DIR", "tmp")
        os.makedirs(tmp_dir, exist_ok=True)
        tmp_file_path = os.path.join(tmp_dir, "upload.tmp")
        file_storage.seek(0)
        with open(tmp_file_path, "wb") as f:
            f.write(file_storage.read())

        embedding_model = _get_embedding_model()

        num_indexed = upload_doc_sections_to_weaviate(
            client=client,
            file_path=tmp_file_path,
            embedding_model=embedding_model,
            collection_name=collection_name,
        )

        return {
            "message": f"Opération terminée. La collection a été réinitialisée et {num_indexed} sections ont été indexées.",
            "user_email": user_email,
            "collection": collection_name,
        }
    finally:
        if client:
            client.close()
            print("Connexion à Weaviate fermée.")