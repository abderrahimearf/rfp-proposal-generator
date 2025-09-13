from joblib import load
import numpy as np
import os
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Construit le chemin complet vers le modèle
model_path1 = os.path.join(BASE_DIR, "models", "svm_sections_hier.joblib")
def predict_section(sample, model_path=model_path1):
    """
    sample: dict avec les clés 'title' et 'content'
    retourne: dict { 'classe', 'sous_classe', 'proba_classe', 'proba_sous_classe' }
    """
    def _to_text(s):
        return (s.get("title", "") or "") + "\n" + (s.get("content", "") or "")

    # Charger l'artefact (dict avec 'model', ou directement un Pipeline)
    artifact = load(model_path)
    if isinstance(artifact, dict) and "model" in artifact:
        model = artifact["model"]
        mapping = artifact.get("mapping_class_to_subclasses", {})
    else:
        model = artifact
        mapping = {}

    x = [_to_text(sample)]

    # Prédiction de base (sans proba)
    y_pred = model.predict(x)[0]  # ex: array(['Administratif & Processus','avis_appel_offres'], dtype=object)
    pred_cl, pred_sc = y_pred[0], y_pred[1]

    proba_classe = None
    proba_sous_classe = None

    # Si calibré: récupérer les probabilités et appliquer la contrainte hiérarchique
    try:
        probas = model.named_steps["clf"].predict_proba(x)  # liste: [probas_classe, probas_sous_classe]
        p_cl = probas[0][0]  # shape (n_classes_cl,)
        p_sc = probas[1][0]  # shape (n_classes_sc,)

        classes_labels = model.named_steps["clf"].estimators_[0].classes_
        sous_labels    = model.named_steps["clf"].estimators_[1].classes_

        # Classe = argmax proba
        pred_cl = classes_labels[np.argmax(p_cl)]

        # Sous-classe: on privilégie les sous-classes autorisées par la classe prédite
        allowed = set(mapping.get(pred_cl, []))
        if allowed:
            idx_sorted = np.argsort(-p_sc)
            pred_sc = next((sous_labels[i] for i in idx_sorted if sous_labels[i] in allowed),
                           sous_labels[np.argmax(p_sc)])
        else:
            pred_sc = sous_labels[np.argmax(p_sc)]

        proba_classe = {str(lbl): float(p) for lbl, p in zip(classes_labels, p_cl)}
        proba_sous_classe = {str(lbl): float(p) for lbl, p in zip(sous_labels, p_sc)}

    except Exception:
        # Pas de probas (modèle non calibré). On peut juste s'assurer de la cohérence hiérarchique.
        allowed = set(mapping.get(pred_cl, []))
        if allowed and pred_sc not in allowed:
            # fallback simple: prendre la 1ère sous-classe autorisée
            pred_sc = sorted(list(allowed))[0]

    return {
        "classe": str(pred_cl),
        "sous_classe": str(pred_sc),
        "proba_classe": proba_classe,           # dict ou None
        "proba_sous_classe": proba_sous_classe  # dict ou None
    }


# --- Exemple d'utilisation ---
if __name__ == "__main__":
    demo = {
    "title": "prentation de l'organisme",
    "content": (
        "notre société est spécialisée dans la fourniture de services informatiques "
    )
}


    print(predict_section(demo))
