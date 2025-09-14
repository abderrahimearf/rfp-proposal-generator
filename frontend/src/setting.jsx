// src/pages/Setting.js
import React, { useState, useEffect } from "react";
import { supabase } from "./api/auth"; // Assurez-vous que le chemin est correct
import Header from "./components/Header"; // Assurez-vous que le chemin est correct
import "./App.css";
import "./App2.css";
import "./Setting.css";

/* =========================
   Configuration
   ========================= */
const styles = {
  toastContainer: {
    position: "fixed",
    right: 16,
    bottom: 16,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    zIndex: 9999,
    pointerEvents: "none",
  },
  toastBase: {
    minWidth: 260,
    maxWidth: 420,
    padding: "12px 14px",
    borderRadius: 10,
    boxShadow: "0 8px 32px rgba(0,0,0,.18)",
    background: "#ffffff",
    fontSize: 14,
    lineHeight: 1.35,
    pointerEvents: "auto",
    borderLeft: "5px solid #5a5a5a",
    transition: "transform .2s ease, opacity .2s ease",
    transform: "translateY(0)",
    opacity: 1,
  },
  toastRow: { display: "flex", alignItems: "center", gap: 10 },
  toastClose: {
    marginLeft: "auto",
    border: "none",
    background: "transparent",
    fontSize: 18,
    lineHeight: 1,
    cursor: "pointer",
    color: "#666",
  },
  success: { background: "#e8f5e9", color: "#1b5e20", borderLeftColor: "#2e7d32" },
  error: { background: "#ffebee", color: "#b71c1c", borderLeftColor: "#c62828" },
  info: { background: "#e3f2fd", color: "#0d47a1", borderLeftColor: "#1976d2" },
};

// =================================================================================
// === Modèles
// =================================================================================
const GOOGLE_MODELS = [
  { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" }
];

const OPENROUTER_MODELS = [
  { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" }
];




const DEFAULT_MODEL_ID = "gemini-1.5-flash";

export default function Setting() {
  // --- GESTION DES NOTIFICATIONS (TOASTS) ---
  const [toasts, setToasts] = useState([]);
  const showToast = (message, type = "info", duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  };
  const closeToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  // --- ÉTATS DU COMPOSANT ---
  const [userRole, setUserRole] = useState(null);
  const [companyName, setCompanyName] = useState("Mon Entreprise");
  const [creativity, setCreativity] = useState(0.7);
  const [maxLength, setMaxLength] = useState(2048);
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);
  const [platform, setPlatform] = useState("google");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState({ message: "", type: "" });

  // --- CHARGEMENT DES DONNÉES ---
  useEffect(() => {
    const loadCurrentUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile) setUserRole(profile.role);

      const { data: userSettings } = await supabase
        .from("parametres")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (userSettings) {
        setCompanyName(userSettings.nom_entreprise || "Mon Entreprise");
        setCreativity(
          typeof userSettings.temperature === "number" ? userSettings.temperature : 0.7
        );
        setMaxLength(
          typeof userSettings.max_tokens === "number" ? userSettings.max_tokens : 2048
        );

        const platformFromDb = userSettings.platform || "google";
        const modelFromDb = userSettings.model || DEFAULT_MODEL_ID;

        setPlatform(platformFromDb);
        setApiKey(userSettings.api_key || "");

        if (platformFromDb === "openrouter" && modelFromDb.startsWith("google/")) {
          setSelectedModelId(modelFromDb.replace("google/", ""));
        } else {
          setSelectedModelId(modelFromDb);
        }
      }
    };

    loadCurrentUserData();
  }, []);

  // --- FONCTIONS ---
  const handlePasswordChange = async () => {
    setPasswordStatus({ message: "", type: "" });

    // Validations
    if (!newPassword || !confirmPassword) {
      const msg = "Veuillez saisir et confirmer le nouveau mot de passe.";
      setPasswordStatus({ message: msg, type: "error" });
      showToast(msg, "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      const msg = "La confirmation ne correspond pas.";
      setPasswordStatus({ message: msg, type: "error" });
      showToast(msg, "error");
      return;
    }
    if (newPassword.length < 8) {
      const msg = "Le mot de passe doit contenir au moins 8 caractères.";
      setPasswordStatus({ message: msg, type: "error" });
      showToast(msg, "error");
      return;
    }

    try {
      // Supabase ne requiert pas le mot de passe actuel pour updateUser()
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      const msg = "Mot de passe modifié avec succès.";
      setPasswordStatus({ message: msg, type: "success" });
      showToast(msg, "success");

      // Nettoyage des champs (limite le déclenchement des gestionnaires de mdp)
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswords(false);
    } catch (err) {
      const msg = "Erreur lors de la mise à jour : " + err.message;
      setPasswordStatus({ message: msg, type: "error" });
      showToast(msg, "error");
    }
  };

  const handleSaveAllSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast("Vous devez être connecté pour sauvegarder.", "error");
      return;
    }

    let modelToSave = selectedModelId;
    if (platform === "openrouter") {
      modelToSave = `google/${selectedModelId}`;
    }

    const payload = {
      user_id: user.id,
      nom_entreprise: companyName?.trim() || "Mon Entreprise",
      model: modelToSave,
      temperature: creativity,
      max_tokens: maxLength,
      updated_at: new Date(),
    };

    if (userRole === "admin") {
      payload.platform = platform;
      payload.api_key = apiKey || null;
    }

    const { error } = await supabase
      .from("parametres")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      showToast("Erreur lors de la sauvegarde : " + error.message, "error");
    } else {
      showToast("Paramètres sauvegardés avec succès !", "success");
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      sessionStorage.clear();
      showToast("Vous êtes déconnecté(e).", "success");
    } catch (err) {
      showToast("Erreur lors de la déconnexion : " + err.message, "error");
    }
  };

  const handlePlatformChange = (newPlatform) => {
    setPlatform(newPlatform);
    if (newPlatform === "openrouter") {
      setSelectedModelId(OPENROUTER_MODELS[0].id);
    } else {
      setSelectedModelId(GOOGLE_MODELS[0].id);
    }
  };

  const modelsForCurrentPlatform =
    platform === "openrouter" ? OPENROUTER_MODELS : GOOGLE_MODELS;

  // --- STRUCTURE JSX ---
  return (
    <div className="app">
      <div className="main">
        <Header title="Paramètres" subtitle="" />
        <div className="settings-grid-container">
          {/* COLONNE 1 : CARTE "MON COMPTE" */}
          <div className="settings-column">
            <section className="card">
              <h2>Mon Compte</h2>
              <p className="card-subtitle">
                Gérez vos informations personnelles et votre sécurité.
              </p>

              <div className="form-group">
                <label htmlFor="companyName">Nom de l’entreprise</label>
                <input
                  type="text"
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Mon Entreprise"
                  autoComplete="off"
                />
              </div>

              <hr className="card-divider" />
              <h3>Changer de mot de passe</h3>

              {/* IMPORTANT : le formulaire a autocomplete="off" pour limiter l'invite Chrome */}
              <form
                autoComplete="off"
                onSubmit={(e) => {
                  e.preventDefault();
                  handlePasswordChange();
                }}
              >
                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="currentPassword">Actuel</label>
                    <input
                      type={showPasswords ? "text" : "password"}
                      id="currentPassword"
                      name="current_pass"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="off"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      spellCheck="false"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="newPassword">Nouveau</label>
                    <input
                      type={showPasswords ? "text" : "password"}
                      id="newPassword"
                      name="new_pass"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="off"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      spellCheck="false"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirmer le nouveau</label>
                  <input
                    type={showPasswords ? "text" : "password"}
                    id="confirmPassword"
                    name="confirm_pass"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    spellCheck="false"
                  />
                </div>

                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="showPasswords"
                    checked={showPasswords}
                    onChange={() => setShowPasswords(!showPasswords)}
                  />
                  <label htmlFor="showPasswords">Afficher les mots de passe</label>
                </div>

                <div className="actions-row">
                  <button type="submit" className="btn">
                    Modifier le mot de passe
                  </button>
                </div>

                {passwordStatus.message && (
                  <p className={`status-message ${passwordStatus.type}`}>
                    {passwordStatus.message}
                  </p>
                )}
              </form>
            </section>
          </div>

          {/* COLONNE 2 : CARTE "PARAMÈTRES IA" */}
          <div className="settings-column">
            <section className="card">
              <h2>Paramètres de l'IA</h2>
              <p className="card-subtitle">
                Ajustez le comportement de l'assistant et gérez les modèles.
              </p>

              {userRole === "admin" && (
                <>
                  <div className="form-group">
                    <label htmlFor="platform">Plateforme (Globale)</label>
                    <select
                      id="platform"
                      value={platform}
                      onChange={(e) => handlePlatformChange(e.target.value)}
                    >
                      <option value="google">Google AI Studio</option>
                      <option value="openrouter">OpenRouter</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="apiKey">Clé API (Globale)</label>
                    <input
                      type={showApiKey ? "text" : "password"}
                      id="apiKey"
                      name="api_key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      autoComplete="off"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      spellCheck="false"
                    />
                  </div>

                  <div className="checkbox-group">
                    <input
                      type="checkbox"
                      id="showApiKey"
                      checked={showApiKey}
                      onChange={() => setShowApiKey(!showApiKey)}
                    />
                    <label htmlFor="showApiKey">Afficher la clé API</label>
                  </div>

                  <hr className="card-divider" />
                </>
              )}

              <h3>Configuration personnelle</h3>
              <div className="form-group">
                <label htmlFor="model">Modèle</label>
                <select
                  id="model"
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                >
                  {modelsForCurrentPlatform.map((modelOption) => (
                    <option key={modelOption.id} value={modelOption.id}>
                      {modelOption.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="creativity">
                  Créativité (température) :{" "}
                  <span className="mono">{creativity}</span>
                </label>
                <input
                  type="range"
                  id="creativity"
                  min="0"
                  max="1"
                  step="0.1"
                  value={creativity}
                  onChange={(e) => setCreativity(parseFloat(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="maxLength">Longueur max. (tokens)</label>
                <input
                  type="number"
                  id="maxLength"
                  min="256"
                  max="8192"
                  value={maxLength}
                  onChange={(e) => setMaxLength(Number(e.target.value))}
                />
              </div>
            </section>
          </div>

          {/* ACTIONS GLOBALES */}
          <div className="global-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleLogout}
              title="Se déconnecter"
            >
              Déconnexion
            </button>
            <button type="button" className="btn" onClick={handleSaveAllSettings}>
              Sauvegarder tous les paramètres
            </button>
          </div>
        </div>
      </div>

      {/* CONTENEUR DE TOASTS */}
      <div style={styles.toastContainer} aria-live="polite" aria-atomic="true">
        {toasts.map((t) => {
          const tone =
            t.type === "success"
              ? styles.success
              : t.type === "error"
              ? styles.error
              : styles.info; // correctif ici
          return (
            <div key={t.id} style={{ ...styles.toastBase, ...tone }}>
              <div style={styles.toastRow}>
                <span>{t.message}</span>
                <button
                  onClick={() => closeToast(t.id)}
                  aria-label="Fermer"
                  style={styles.toastClose}
                  title="Fermer"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
