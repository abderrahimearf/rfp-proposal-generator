# services/pipelines.py
from typing import List
from sentence_transformers import SentenceTransformer

# La classe est maintenant dans un fichier dédié, avec une "adresse" fixe et importable.
class SemanticPipeline:
    def __init__(self, encoder: SentenceTransformer, classifier):
        self.encoder = encoder
        self.classifier = classifier

    def predict(self, texts: List[str]) -> List[str]:
        if isinstance(texts, str):
            texts = [texts]
        embeddings = self.encoder.encode(texts, show_progress_bar=False)
        return self.classifier.predict(embeddings)