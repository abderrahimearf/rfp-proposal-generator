// src/Home.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';
import logo from './components/logo2.png';
import logo2 from './components/logo.png';
// Importez les icônes que vous souhaitez utiliser
import { FaLinkedin, FaEnvelope } from 'react-icons/fa';

// Assurez-vous que le chemin vers vos fonctions d'authentification est correct
import { signInWithEmailPassword, signUpWithEmailPassword } from "./api/auth";

export default function Home() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: signInError } = await signInWithEmailPassword(email.trim().toLowerCase(), password);
      if (signInError) throw new Error("L'adresse e-mail ou le mot de passe est incorrect.");
      navigate("/Dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: signUpError } = await signUpWithEmailPassword(email.trim().toLowerCase(), password);
      if (signUpError) throw signUpError;
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Une erreur est survenue lors de l'inscription.");
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = (e) => {
    e.preventDefault();
    setMode(mode === 'login' ? 'register' : 'login');
    setEmail("");
    setPassword("");
    setError("");
  };

  return (
    <div className="home-container">
      {/* ===== Section de Gauche (Information) ===== */}
      <div className="info-panel">
        <div className="info-panel-content">
          <img src={logo} alt="Logo de Propose Flow AI" className="logo" />
          <h1>Transformez Vos Réponses Stratégiques avec l'IA</h1>
          <p className="description">
            Notre plateforme intelligente automatise la création de vos
            documents commerciaux complexes. Augmentez votre efficacité, assurez la cohérence
            et optimisez chaque réponse pour maximiser vos chances de succès.
          </p>
          <ul className="feature-list">
            <li className="feature-item">Génération de brouillons par l'IA</li>
            <li className="feature-item">Export professionnel via des modèles personnalisés</li>
            <li className="feature-item">Base de connaissance centralisée et intelligente</li>
          </ul>
        </div>

        {/* ===== FOOTER STYLÉ AVEC ICÔNES ===== */}
        <footer className="info-footer">
          <p>Contactez-nous :</p>
          <div className="footer-links">
            <a href="https://www.linkedin.com/company/votre-entreprise" target="_blank" rel="noopener noreferrer">
              <FaLinkedin className="footer-icon" />
              LinkedIn
            </a>
            <a href="mailto:contact@votre-entreprise.com">
              <FaEnvelope className="footer-icon" />
              Email
            </a>
          </div>
        </footer>
      </div>

      {/* ===== Section de Droite (Formulaire Dynamique) ===== */}
      <div className="login-panel">
        <div className="login-form-container">
          <h2>{mode === 'login' ? 'Bienvenue !' : 'Créer un compte'}</h2>
          <p className="login-subtitle">
            {mode === 'login' ? 'Connectez-vous pour continuer' : 'Commencez par créer votre compte'}
          </p>
          <form onSubmit={mode === 'login' ? handleLogin : handleRegister}>
            <div className="input-group">
              <label htmlFor="email">Adresse e-mail</label>
              <input type="email" id="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="input-group">
              <label htmlFor="password">Mot de passe</label>
              <input type="password" id="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="error-message">{error}</p>}
            <button type="submit" className="connect-button" disabled={loading}>
              {loading ? 'Chargement...' : (mode === 'login' ? 'connexion' : 'créer le compte')}
            </button>
          </form>
          <p className="signup-link">
            {mode === 'login' ? "Vous n'avez pas de compte ? " : "Vous avez déjà un compte ? "}
            <a href="#" onClick={toggleMode}>
              {mode === 'login' ? "S'inscrire" : 'Se connecter'}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}