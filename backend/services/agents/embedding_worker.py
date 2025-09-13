# backend/backend/services/agents/embedding_worker.py
import os
import sys
import json

# On s'assure que cette variable est définie avant TOUT le reste
os.environ["TOKENIZERS_PARALLELISM"] = "false"

from sentence_transformers import SentenceTransformer

def worker_loop(model_path):
    """Charge le modèle une fois, puis traite le texte ligne par ligne."""
    try:
        model = SentenceTransformer(model_path, device='cpu')
        sys.stderr.write("[WORKER] Modèle chargé et prêt.\n")
        sys.stderr.flush()
    except Exception as e:
        sys.stderr.write(f"[WORKER] ERREUR DE CHARGEMENT: {e}\n")
        sys.stderr.flush()
        return

    # Boucle infinie pour lire les requêtes depuis l'entrée standard
    for line in sys.stdin:
        try:
            text_to_encode = line.strip()
            if text_to_encode:
                vector = model.encode([text_to_encode], normalize_embeddings=True)[0].tolist()
                # On écrit le résultat sur la sortie standard
                sys.stdout.write(json.dumps(vector) + '\n')
                sys.stdout.flush()
        except Exception as e:
            # En cas d'erreur, on écrit sur la sortie d'erreur
            sys.stderr.write(f"[WORKER] ERREUR D'ENCODAGE: {e}\n")
            sys.stderr.flush()

if __name__ == '__main__':
    if len(sys.argv) > 1:
        local_model_path = sys.argv[1]
        worker_loop(local_model_path)