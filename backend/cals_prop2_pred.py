# coding: utf-8
import joblib
from sentence_transformers import SentenceTransformer



class SemanticPipeline:
    def __init__(self, encoder, classifier):
        self.encoder = encoder
        self.classifier = classifier
    def predict(self, texts):
        if isinstance(texts, str):
            texts = [texts]
        embeddings = self.encoder.encode(texts)
        return self.classifier.predict(embeddings)


MODEL_PATH = "svm_semantic_pipeline_final.joblib"

# 2. Charger le modèle
print("Chargement du modèle...")
model = joblib.load(MODEL_PATH)
print("Modèle prêt.")

# 3. Phrases que vous voulez tester
phrases_a_tester = [
    "Le budget pour ce projet est de 50k€.",
    "Le client se plaint de la lenteur du système actuel.",
    "Notre contrat stipule une disponibilité de 99.9%.",
    "Pour résumer, l'offre est très compétitive."
]

# 4. Faire la prédiction
print("\nLancement de la prédiction...")
predictions = model.predict(phrases_a_tester)

# 5. Afficher les résultats
for phrase, pred_class in zip(phrases_a_tester, predictions):
    print(f"'{phrase}'  ===>  {pred_class}")