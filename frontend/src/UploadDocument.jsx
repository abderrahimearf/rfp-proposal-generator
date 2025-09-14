import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import { useAuth } from "./auth/AuthContext";
import "./UploadDocument.css";
import { supabase } from "./api/auth";

const API_BASE_URL = "http://localhost:5000/api";
const DOCUMENTS_BUCKET = "Documents";

/** CSS compact pour le bloc "Dernier document ajouté" (auto-contenu) */
const LASTDOC_CSS = `
.lastdoc{padding:8px 10px;margin:8px 0 12px;border:1px solid #e5e7eb;background:#f9fafb;border-radius:8px}
.lastdoc__title{margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.03em;color:#334155;text-transform:uppercase}
.lastdoc__list{margin:0;padding:0;list-style:none;font-size:13px;line-height:1.25;color:#0f172a}
.lastdoc__item{display:flex;gap:6px}
.lastdoc__label{color:#475569;min-width:92px;flex:none}
.lastdoc__value{font-weight:600}
@media (max-width:520px){.lastdoc__item{flex-direction:column}.lastdoc__label{min-width:0}}
`;

export default function UploadDocument() {
  const { session } = useAuth();

  // Formulaire
  const [destinataire, setDestinataire] = useState("");
  const [projet, setProjet] = useState("");
  const [secteur, setSecteur] = useState("");

  // Upload
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  // Métadonnées du dernier fichier
  const [lastDoc, setLastDoc] = useState(null);

  // Helpers
  const formatDate = (d) => (d ? new Date(d).toLocaleString("fr-FR") : "");
  const formatSize = (s) => {
    if (s == null) return "";
    if (s < 1024) return `${s} o`;
    if (s < 1024 * 1024) return `${(s / 1024).toFixed(1)} Ko`;
    if (s < 1024 * 1024 * 1024) return `${(s / (1024 * 1024)).toFixed(1)} Mo`;
    return `${(s / (1024 * 1024 * 1024)).toFixed(1)} Go`;
  };

  // Récupérer le dernier document à la (re)connexion
  useEffect(() => {
    const fetchLastDoc = async () => {
      if (!session?.user?.id) { setLastDoc(null); return; }
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) { console.error("Erreur fetch lastDoc:", error); return; }
      setLastDoc(data || null);
    };
    fetchLastDoc();
  }, [session?.user?.id]);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setStatus(null);
  };

  const handleUpload = async () => {
    // Validation
    if (!session?.user?.email || !session?.user?.id) {
      setStatus({ type: "error", message: "Veuillez vous connecter pour indexer un document." });
      return;
    }
    if (!destinataire || !projet || !secteur) {
      setStatus({ type: "error", message: "Veuillez remplir tous les champs : Destinataire, Projet et Secteur." });
      return;
    }
    if (!file) {
      setStatus({ type: "error", message: "Veuillez sélectionner un fichier." });
      return;
    }

    setLoading(true);
    setStatus(null);
    let uploadedPath = null;

    try {
      // ÉTAPE 1 : Upload Storage
      setStatus({ type: "info", message: "Sauvegarde du fichier sur Supabase..." });

      const filePath = `${session.user.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(filePath, file);
      if (upErr) throw new Error(`Erreur d'upload Supabase Storage : ${upErr.message}`);
      uploadedPath = filePath;

      // ÉTAPE 1bis : Insert DB + récupérer la ligne
      const { data: inserted, error: dbErr } = await supabase
        .from("documents")
        .insert({
          nom: projet.trim(),
          client: destinataire.trim(),
          secteur: secteur.trim(),
          storage_path: filePath,
          file_name: file.name,
          user_id: session.user.id,
          mime_type: file.type ?? null,
          size_bytes: file.size ?? null,
        })
        .select("*")
        .single();

      if (dbErr) throw new Error(`Erreur de base de données Supabase : ${dbErr.message}`);

      // ÉTAPE 2 : Indexation IA (Weaviate)
      setStatus({ type: "info", message: "Document sauvegardé. Indexation pour l'IA en cours..." });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("email", session.user.email);
      formData.append("destinataire", destinataire);
      formData.append("projet", projet);
      formData.append("budget", "0"); // conservé pour compat backend

      const res = await fetch(`${API_BASE_URL}/stock-doc`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erreur serveur d'indexation (${res.status})`);

      setStatus({ type: "success", message: "Document sauvegardé et indexé avec succès !" });

      // Reset formulaire
      setFile(null);
      setDestinataire("");
      setProjet("");
      setSecteur("");

      // Mettre à jour l'état "dernier doc"
      setLastDoc(inserted);
    } catch (err) {
      console.error(err);
      setStatus({ type: "error", message: err.message || "Une erreur est survenue." });

      if (uploadedPath) {
        try {
          await supabase.storage.from(DOCUMENTS_BUCKET).remove([uploadedPath]);
        } catch (cleanupError) {
          console.error("Erreur lors du nettoyage du fichier orphelin:", cleanupError);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const headerSubtitle = session ? `${session.user.email}` : "Connexion requise";

  return (
    <div className="page page--compact">
      {/* Styles compacts injectés */}
      <style dangerouslySetInnerHTML={{ __html: LASTDOC_CSS }} />
      <Header title="Indexer un Document" subtitle={headerSubtitle} />

      {/* NOTE : plus de centrage vertical plein écran */}
      <main className="main-center main-center--top">
        <div className="container">
          <section className="card card--narrow card--compact">
            {!session ? (
              <>
                <h2 className="card__title">Accès non autorisé</h2>
                <p className="card__desc">Vous devez être connecté pour pouvoir indexer un nouveau document.</p>
              </>
            ) : (
              <>
                <h2 className="card__title">Veuillez uploader votre cahier des charges</h2>
                <p className="card__desc">
                  Le document sera analysé et ses sections seront indexées pour être utilisées par l&apos;assistant.
                  Tout document précédemment indexé sera remplacé.
                </p>

                {/* --- Bloc compact : Dernier fichier ajouté --- */}
                <div className="lastdoc">
                  <div className="lastdoc__title">Dernier appel d’offre ajouté pris en compte</div>
                  {lastDoc ? (
                    <ul className="lastdoc__list">
                      <li className="lastdoc__item">
                        <span className="lastdoc__label">Fichier :</span>
                        <span className="lastdoc__value">
                          {lastDoc.file_name} {lastDoc.size_bytes ? `(${formatSize(lastDoc.size_bytes)})` : ""}
                        </span>
                      </li>
                      <li className="lastdoc__item">
                        <span className="lastdoc__label">Projet :</span>
                        <span className="lastdoc__value">{lastDoc.nom}</span>
                      </li>
                      <li className="lastdoc__item">
                        <span className="lastdoc__label">Destinataire :</span>
                        <span className="lastdoc__value">{lastDoc.client}</span>
                      </li>
                      <li className="lastdoc__item">
                        <span className="lastdoc__label">Secteur :</span>
                        <span className="lastdoc__value">{lastDoc.secteur}</span>
                      </li>
                      <li className="lastdoc__item">
                        <span className="lastdoc__label">Ajouté le :</span>
                        <span className="lastdoc__value">{formatDate(lastDoc.created_at)}</span>
                      </li>
                    </ul>
                  ) : (
                    <div className="lastdoc__list" style={{ color: "#64748b" }}>
                      Aucun document n’a encore été ajouté.
                    </div>
                  )}
                </div>

                {/* Formulaire */}
                <div className="form-grid form-grid--compact">
                  <div className="field">
                    <label htmlFor="destinataire" className="label">Destinataire</label>
                    <input
                      id="destinataire"
                      type="text"
                      placeholder="ex. Entreprise X"
                      className="input"
                      value={destinataire}
                      onChange={(e) => setDestinataire(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="projet" className="label">Projet</label>
                    <input
                      id="projet"
                      type="text"
                      placeholder="ex. Refonte du CRM"
                      className="input"
                      value={projet}
                      onChange={(e) => setProjet(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="secteur" className="label">Secteur</label>
                    <input
                      id="secteur"
                      type="text"
                      placeholder="ex. Finance, Santé..."
                      className="input"
                      value={secteur}
                      onChange={(e) => setSecteur(e.target.value)}
                    />
                  </div>
                </div>

                <input
                  type="file"
                  id="file-upload"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="input-file"
                  disabled={loading}
                />
                <label htmlFor="file-upload" className="btn btn--ghost">
                  {file ? "Changer de fichier" : "Choisir un fichier"}
                </label>

                {file && (
                  <div className="file-name" aria-live="polite">
                    Fichier sélectionné : <strong>{file.name}</strong>
                  </div>
                )}

                <button
                  onClick={handleUpload}
                  disabled={
                    loading ||
                    !file ||
                    !destinataire.trim() ||
                    !projet.trim() ||
                    !secteur.trim()
                  }
                  className="btn btn--primary btn--block"
                >
                  {loading ? "Traitement en cours..." : "Sauvegarder et Indexer"}
                </button>

                {status && (
                  <p
                    role="status"
                    className={`status ${
                      status.type === "success" ? "status--ok" :
                      status.type === "error" ? "status--err" :
                      "status--info"
                    }`}
                  >
                    {status.message}
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
