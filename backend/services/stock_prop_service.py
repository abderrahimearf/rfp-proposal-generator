# services/stock_prop_service.py
import os
import uuid
import re
import warnings
from pathlib import Path
from typing import List, Dict

import sys, types  # <<< ajouté
import weaviate
from weaviate.auth import AuthApiKey
from weaviate.classes.config import Property, DataType, Configure
from sentence_transformers import SentenceTransformer
from joblib import load
from dotenv import load_dotenv

from docling.document_converter import DocumentConverter
from config import Config

# --- Import de la classe dans un module fixe ---
from services.pipelines import SemanticPipeline  # <-- ta classe

load_dotenv()
warnings.filterwarnings("ignore", category=UserWarning)

# --- CONFIG & CACHES ---
_PROP_MODEL_PATH_DEFAULT = "services/models/svm_semantic_pipeline_final.joblib"
_PROP_MODEL_PATH = getattr(Config, "PROP_MODEL_PATH", _PROP_MODEL_PATH_DEFAULT)
_MODEL_EMB: SentenceTransformer | None = None
_MODEL_CLS_PROP = None

def _sanitize_email_for_collection_name(email: str) -> str:
    sanitized = re.sub(r'[^a-zA-Z0-9]', '', email)
    if not sanitized:
        raise ValueError("L'email fourni est invalide après nettoyage.")
    return sanitized.capitalize() + "Prop"

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

def _resolve_prop_model_path() -> str:
    p = Path(_PROP_MODEL_PATH)
    if p.exists():
        return str(p)
    cand = Path(__file__).resolve().parent.parent / _PROP_MODEL_PATH
    if cand.exists():
        return str(cand)
    raise FileNotFoundError(f"Modèle introuvable: {_PROP_MODEL_PATH}")

# --------- SHIM PICKLE: mappe __main__.SemanticPipeline -> services.pipelines.SemanticPipeline ---------
def _ensure_pickle_compat():
    """
    Certains .joblib anciens pointent vers __main__.SemanticPipeline.
    Ici on crée/complète __main__ pour que le dépickler retrouve la classe.
    """
    main_mod = sys.modules.get('__main__')
    if main_mod is None:
        main_mod = types.ModuleType('__main__')
        sys.modules['__main__'] = main_mod
    if not hasattr(main_mod, 'SemanticPipeline'):
        setattr(main_mod, 'SemanticPipeline', SemanticPipeline)

def _get_classifier():
    global _MODEL_CLS_PROP
    if _MODEL_CLS_PROP is None:
        path = _resolve_prop_model_path()
        print(f"Chargement du classifieur depuis : {path}")
        _ensure_pickle_compat()          # <<< IMPORTANT : AVANT load()
        _MODEL_CLS_PROP = load(path)
    return _MODEL_CLS_PROP

def predict_labels_batch(texts: List[str]) -> List[str]:
    return _get_classifier().predict(texts)

def _get_embedding_model() -> SentenceTransformer:
    global _MODEL_EMB
    if _MODEL_EMB is None:
        device = getattr(Config, "EMBED_DEVICE", None)
        model_name = getattr(Config, "EMBED_MODEL", "intfloat/multilingual-e5-small")
        print(f"Chargement du modèle d'embedding '{model_name}' (device={device or 'auto'})...")
        _MODEL_EMB = SentenceTransformer(model_name_or_path=model_name, device=device)
    return _MODEL_EMB

def setup_prop_schema_if_not_exists(client: weaviate.WeaviateClient, collection_name: str):
    if client.collections.exists(collection_name):
        print(f"La collection '{collection_name}' existe déjà. Aucune action n'est requise.")
        return

    print(f"Création du schéma pour la collection '{collection_name}'...")
    props = [
        Property(name="title",   data_type=DataType.TEXT),
        Property(name="contenu", data_type=DataType.TEXT),
        Property(name="classe",  data_type=DataType.TEXT),
    ]
    client.collections.create(
        name=collection_name,
        description=f"Sections de propositions pour la collection {collection_name}.",
        properties=props,
        vectorizer_config=Configure.Vectorizer.none(),  # OK mais déprécié => vector_config plus tard
    )
    print(f"Collection '{collection_name}' créée avec succès.")

def upload_prop_sections_to_weaviate(client: weaviate.WeaviateClient, file_path: str, embedding_model: SentenceTransformer, collection_name: str):
    prop_col = client.collections.get(collection_name)
    sections = docling_sections(file_path)
    if not sections:
        return 0

    titles = [s.get("title", "") for s in sections]
    # FIX: lire la bonne clé "content" (et non "contenu")
    contents = [s.get("content", "") for s in sections]

    texts_for_pred = [f"{t}\n\n{c}" for t, c in zip(titles, contents)]
    print("Classification des sections...")
    classes = predict_labels_batch(texts_for_pred)

    print("Calcul des embeddings...")
    model_name = getattr(Config, "EMBED_MODEL", "")
    prefix = "passage: " if "e5" in model_name.lower() else ""
    texts_for_vec = [prefix + text for text in texts_for_pred]
    batch_size = int(getattr(Config, "EMBED_BATCH_SIZE", 32))

    vecs = embedding_model.encode(
        texts_for_vec,
        batch_size=batch_size,
        normalize_embeddings=True,
        show_progress_bar=True
    )

    print("Insertion des données dans Weaviate...")
    src_name = Path(file_path).name
    with prop_col.batch.dynamic() as batch:
        for i, (title, cont, classe, vec) in enumerate(zip(titles, contents, classes, vecs)):
            uid = uuid.uuid5(uuid.NAMESPACE_URL, f"{src_name}|{collection_name}|{i}|{title[:64]}")
            properties = {"title": title, "contenu": cont, "classe": classe}
            batch.add_object(properties=properties, uuid=uid, vector=vec.tolist())

    print(f"{len(sections)} sections ajoutées à la collection '{collection_name}'.")
    return len(sections)

def save_and_index_proposal(file_storage, user_email: str):
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

        setup_prop_schema_if_not_exists(client, collection_name)

        tmp_dir = getattr(Config, "TMP_DIR", "tmp")
        os.makedirs(tmp_dir, exist_ok=True)
        tmp_file_path = os.path.join(tmp_dir, "upload.tmp")
        file_storage.seek(0)
        with open(tmp_file_path, "wb") as f:
            f.write(file_storage.read())

        embedding_model = _get_embedding_model()

        num_indexed = upload_prop_sections_to_weaviate(
            client=client,
            file_path=tmp_file_path,
            embedding_model=embedding_model,
            collection_name=collection_name,
        )

        return {
            "message": f"Opération terminée. {num_indexed} sections indexées pour l'utilisateur.",
            "user_email": user_email,
            "collection": collection_name,
        }
    finally:
        if client:
            client.close()
            print("Connexion à Weaviate fermée.")
