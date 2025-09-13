

from pathlib import Path
from collections import Counter, defaultdict
import numpy as np
from joblib import dump

import argparse, json, io, os
from sklearn import __version__ as skl_version
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline, FeatureUnion
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import GridSearchCV, KFold, train_test_split
from sklearn.metrics import classification_report, f1_score, confusion_matrix, make_scorer
from sklearn.multioutput import MultiOutputClassifier

# ---------------------------------------------------------------------
# Stopwords FR (liste simple, modifiable).
# ---------------------------------------------------------------------
FR_STOPWORDS = [
    "a","afin","ai","ainsi","alors","apres","après","au","aucun","aucune","aujourd",
    "hui","aujourd'hui","aura","auront","aussi","autre","autres","aux","avaient",
    "avais","avait","avec","avoir","avons","ayant","bah","beaucoup","bien","bon",
    "car","ce","cela","celle","celles","celui","cent","cependant","certain",
    "certaine","certaines","certains","ces","cet","cette","ceux","chacun","chaque",
    "chez","comme","comment","d","dans","de","debout","dedans","dehors","delà",
    "depuis","derriere","derrière","des","dessous","dessus","deux","devant","doit",
    "doivent","donc","dont","du","durant","elle","elles","en","encore","entre",
    "envers","est","et","etaient","étaient","etais","étais","etait","était","etant",
    "étant","etes","êtes","eu","eurent","eut","eux","fait","faite","faites","fois",
    "font","furent","fut","grace","grâce","haut","hors","hum","il","ils","j","je",
    "jusqu","jusque","l","la","le","les","leur","leurs","lors","lorsque","lui","là",
    "l’un","l’une","ma","mais","mal","me","meme","même","mes","mien","mienne",
    "miennes","miens","moi","moins","mon","moyennant","ne","ni","non","nos","notre",
    "nous","nouveau","nouveaux","on","ont","ou","où","ouais","par","parce","parmi",
    "pas","pendant","peu","peut","peuvent","peux","plus","plusieurs","plutot",
    "plutôt","pour","pourquoi","près","pu","puis","qu","quand","quant","quatre",
    "que","quel","quelle","quelles","quels","qui","quoi","s","sa","sans","ses",
    "seulement","si","sien","sienne","siennes","siens","sinon","soi","soit","sommes",
    "son","sont","sous","souvent","soyez","suis","sur","t","ta","tandis","te","tel",
    "telle","telles","tels","tes","toi","ton","tous","tout","toute","toutes","tres",
    "très","trop","tu","un","une","vers","voici","voilà","vos","votre","vous","y",
]

# ---------------------------------------------------------------------
# 1) Préparation des données
# ---------------------------------------------------------------------
def to_text(title: str, content: str) -> str:
    return (title or "") + "\n" + (content or "")

def prepare_xy_hier(recs):
    """
    Entrée: [{title, content, classe, sous_classe}, ...]
    Sortie:
      - X: list[str] (title + '\n' + content)
      - Y: np.ndarray shape (n_samples, 2) => [:,0] = classe, [:,1] = sous_classe
      - y_joint: list[str] pour stratification, ex: "classe@@sous_classe"
      - mapping: dict[str, list[str]] mappage classe -> sous_classes rencontrées
    """
    X = []
    classes, sous_classes, y_joint = [], [], []
    mapping = defaultdict(set)

    for r in recs:
        c = str(r["classe"]).strip()
        sc = str(r["sous_classe"]).strip()
        X.append(to_text(r.get("title",""), r.get("content","")))
        classes.append(c)
        sous_classes.append(sc)
        y_joint.append(f"{c}@@{sc}")
        mapping[c].add(sc)

    Y = np.column_stack([np.array(classes, dtype=object),
                         np.array(sous_classes, dtype=object)])
    mapping = {k: sorted(list(v)) for k, v in mapping.items()}
    return X, Y, y_joint, mapping

def min_count_per_label(y):
    cnt = Counter(y)
    return (min(cnt.values()) if cnt else 0), cnt

# ---------------------------------------------------------------------
# 2) Pipeline / score / calibration
# ---------------------------------------------------------------------
def build_features():
    tfidf_word = TfidfVectorizer(
        analyzer="word",
        ngram_range=(1, 2),
        min_df=1,
        max_df=0.95,
        lowercase=True,
        stop_words=FR_STOPWORDS,
    )
    tfidf_char = TfidfVectorizer(
        analyzer="char",
        ngram_range=(3, 5),
        min_df=1,
        lowercase=True,
    )
    return FeatureUnion([("w", tfidf_word), ("c", tfidf_char)])

def build_multioutput_estimator(calib_cv: int | None):
    base_svm = LinearSVC(class_weight="balanced")
    if calib_cv is not None and calib_cv >= 2:
        est = CalibratedClassifierCV(estimator=base_svm, cv=calib_cv)
    else:
        est = base_svm
    return MultiOutputClassifier(estimator=est, n_jobs=None)

def f1_macro_multioutput(y_true, y_pred):
    """
    y_*: array-like shape (n_samples, 2) de strings
    Retourne la moyenne des f1_macro calculés séparément sur chaque colonne.
    """
    y_true = np.asarray(y_true, dtype=object)
    y_pred = np.asarray(y_pred, dtype=object)
    scores = []
    for col in range(y_true.shape[1]):
        scores.append(f1_score(y_true[:, col], y_pred[:, col], average="macro"))
    return float(np.mean(scores))

from sklearn.metrics import make_scorer
F1_MACRO_MULTI_SCORER = make_scorer(f1_macro_multioutput, greater_is_better=True)

# ---------------------------------------------------------------------
# 3) Entraînement
# ---------------------------------------------------------------------
if __name__ == "__main__":
    # Arguments & chemins par défaut (à côté du script)
    parser = argparse.ArgumentParser()
    script_dir = Path(__file__).resolve().parent
    parser.add_argument("--data", default=str(script_dir / "train_sections.json"),
                        help="Chemin du fichier JSON d'entraînement")
    parser.add_argument("--out", default=str(script_dir / "models" / "svm_sections_hier.joblib"),
                        help="Chemin de sortie du modèle .joblib")
    args = parser.parse_args()

    data_path = Path(args.data)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Charger le JSON
    assert data_path.exists(), f"Dataset introuvable: {data_path}"
    with io.open(data_path, "r", encoding="utf-8") as f:
        records_hier = json.load(f)

    # Validation simple
    if not isinstance(records_hier, list) or len(records_hier) == 0:
        raise ValueError("Le JSON doit contenir une liste non vide.")
    for i, r in enumerate(records_hier):
        for k in ("title","content","classe","sous_classe"):
            if k not in r or not str(r[k]).strip():
                raise ValueError(f"Enregistrement {i} invalide: champ manquant '{k}'")

    print(f"[INFO] scikit-learn version: {skl_version}")
    X_all, Y_all, y_joint, mapping = prepare_xy_hier(records_hier)

    # Stats
    n = len(X_all)
    classes_all = Y_all[:, 0]
    sous_all = Y_all[:, 1]
    min_per_class_cl, cnt_cl = min_count_per_label(classes_all)
    min_per_class_sc, cnt_sc = min_count_per_label(sous_all)
    unique_cl = len(cnt_cl)
    unique_sc = len(cnt_sc)

    print(f"[INFO] N={n} | classes={unique_cl} (min={min_per_class_cl}) | "
          f"sous_classes={unique_sc} (min={min_per_class_sc})")

    # Calibration: exiger >= 4 échantillons pour chaque niveau
    if min_per_class_cl >= 4 and min_per_class_sc >= 4:
        calib_cv = 3  # ou 2 si dataset moyen
    else:
        calib_cv = None

    # Param grid pour TF-IDF
    param_grid = {
        "feats__w__ngram_range": [(1, 2), (1, 3)],
        "feats__c__ngram_range": [(3, 5), (3, 6)],
        # Exemple si tu veux tuner C quand la calibration est active:
        # "clf__estimator__estimator__C": [0.5, 1.0, 2.0],
    }

    # Pipeline (features + multi-output classifier)
    feats = build_features()
    clf = build_multioutput_estimator(calib_cv=calib_cv)
    pipe = Pipeline([("feats", feats), ("clf", clf)])

    # ---- Split 70/15/15 stratifié sur le couple (classe@@sous) si possible
    def can_holdout(y_joint_labels, valid_ratio=0.15, test_ratio=0.15):
        n_local = len(y_joint_labels)
        n_classes_local = len(set(y_joint_labels))
        counts = Counter(y_joint_labels)
        min_per = min(counts.values())
        n_test = int(round(n_local * test_ratio))
        n_valid = int(round(n_local * valid_ratio))
        return (
            n_test >= n_classes_local and
            n_valid >= n_classes_local and
            min_per >= 2 and
            n_local - (n_test + n_valid) >= n_classes_local
        )

    if can_holdout(y_joint, 0.15, 0.15):
        print("[INFO] Split 70/15/15 (stratifié sur (classe,sous_classe)).")
        X_train, X_temp, Y_train, Y_temp, yj_train, yj_temp = train_test_split(
            X_all, Y_all, y_joint, test_size=0.30, random_state=42, stratify=y_joint
        )
        X_valid, X_test, Y_valid, Y_test, yj_valid, yj_test = train_test_split(
            X_temp, Y_temp, yj_temp, test_size=0.50, random_state=42, stratify=yj_temp
        )

        # KFold pour GridSearch (MultiOutput ne gère pas facilement StratifiedKFold)
        n_splits = 3 if n >= 90 else 2
        cv = KFold(n_splits=n_splits, shuffle=True, random_state=42)

        grid = GridSearchCV(
            pipe, param_grid=param_grid, cv=cv,
            scoring=F1_MACRO_MULTI_SCORER, n_jobs=-1, verbose=1
        )
        grid.fit(X_train, Y_train)
        print("Best params:", grid.best_params_)
        print("Best f1_macro (CV):", grid.best_score_)
        best = grid.best_estimator_

        # Évaluation holdout séparée par sortie
        Y_pred_val = best.predict(X_valid)
        print("\n[VALID] F1-macro CLASSE:",
              f1_score(Y_valid[:,0], Y_pred_val[:,0], average="macro"))
        print("[VALID] F1-macro SOUS_CLASSE:",
              f1_score(Y_valid[:,1], Y_pred_val[:,1], average="macro"))
        print("\n[VALID] Rapport CLASSE\n",
              classification_report(Y_valid[:,0], Y_pred_val[:,0]))
        print("\n[VALID] Rapport SOUS_CLASSE\n",
              classification_report(Y_valid[:,1], Y_pred_val[:,1]))

        Y_pred_test = best.predict(X_test)
        print("\n[TEST] F1-macro CLASSE:",
              f1_score(Y_test[:,0], Y_pred_test[:,0], average="macro"))
        print("[TEST] F1-macro SOUS_CLASSE:",
              f1_score(Y_test[:,1], Y_pred_test[:,1], average="macro"))

        print("\n[TEST] Confusion CLASSE\n",
              confusion_matrix(Y_test[:,0], Y_pred_test[:,0]))
        print("\n[TEST] Confusion SOUS_CLASSE\n",
              confusion_matrix(Y_test[:,1], Y_pred_test[:,1]))
    else:
        print("[WARN] Dataset trop petit pour 70/15/15 stratifié.")
        print("[INFO] GridSearch avec KFold, puis fit sur tout le dataset.")
        n_splits = 3 if n >= 90 else 2
        cv = KFold(n_splits=n_splits, shuffle=True, random_state=42)
        grid = GridSearchCV(
            pipe, param_grid=param_grid, cv=cv,
            scoring=F1_MACRO_MULTI_SCORER, n_jobs=-1, verbose=1
        )
        grid.fit(X_all, Y_all)
        print("Best params:", grid.best_params_)
        print("Best f1_macro (CV):", grid.best_score_)
        best = grid.best_estimator_

    # -----------------------------------------------------------------
    # 4) Sauvegarde modèle + méta + démo de prédiction
    # -----------------------------------------------------------------
    artifact = {
        "model": best,
        "sklearn_version": skl_version,
        "mapping_class_to_subclasses": mapping,
        "all_classes": sorted(list(set(classes_all))),
        "all_subclasses": sorted(list(set(sous_all))),
    }
    dump(artifact, out_path)
    print(f"Modèle sauvegardé -> {out_path}")

    # ---------------- Démo prédiction (avec contrainte hiérarchique) -------------
    def predict_one(text: str):
        x = [text]
        try:
            # si calibré -> probas dispo (une liste par sortie)
            probas = best.named_steps["clf"].predict_proba(x)
            p_cl = probas[0][0]  # (n_classes_cl,)
            p_sc = probas[1][0]  # (n_classes_sc,)

            classes_labels = best.named_steps["clf"].estimators_[0].classes_
            sous_labels    = best.named_steps["clf"].estimators_[1].classes_

            pred_cl = classes_labels[np.argmax(p_cl)]
            # Contraindre la sous_classe au mapping de la classe prédite
            allowed = set(artifact["mapping_class_to_subclasses"].get(pred_cl, []))
            if allowed:
                idx_sorted = np.argsort(-p_sc)
                pred_sc = next((sous_labels[i] for i in idx_sorted if sous_labels[i] in allowed),
                               sous_labels[np.argmax(p_sc)])
            else:
                pred_sc = sous_labels[np.argmax(p_sc)]

            proba_cl_dict = {lbl: float(p) for lbl, p in zip(classes_labels, np.round(p_cl, 6))}
            proba_sc_dict = {lbl: float(p) for lbl, p in zip(sous_labels, np.round(p_sc, 6))}
            return pred_cl, pred_sc, proba_cl_dict, proba_sc_dict

        except Exception:
            # pas de probas -> simple predict + correction hiérarchique
            y_pred = best.predict(x)[0]  # shape (2,)
            pred_cl, pred_sc = y_pred[0], y_pred[1]
            allowed = set(artifact["mapping_class_to_subclasses"].get(pred_cl, []))
            if allowed and pred_sc not in allowed:
                freq = Counter(sc for (c, sc) in zip(classes_all, sous_all) if c == pred_cl)
                pred_sc = freq.most_common(1)[0][0] if freq else pred_sc
            return pred_cl, pred_sc, None, None

    # Exemple démo
    demo = {
        "title": "Publication d'un avis d'appel d'offres",
        "content": "L'autorité contractante publie un avis d'appel d'offres sur le portail officiel..."
    }
    demo_text = to_text(demo["title"], demo["content"])
    out = predict_one(demo_text)
    if out[2] is not None:
        pred_cl, pred_sc, pcl, psc = out
        print("\nDEMO PREDICTION:")
        print("  classe     :", pred_cl)
        print("  sous_classe:", pred_sc)
        print("  proba_classe     :", pcl)
        print("  proba_sous_classe:", psc)
    else:
        pred_cl, pred_sc, _, _ = out
        print("\nDEMO PREDICTION (sans probas):")
        print("  classe     :", pred_cl)
        print("  sous_classe:", pred_sc)
