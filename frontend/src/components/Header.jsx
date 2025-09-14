import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from './logo.png';
export default function Header() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActive = (path) => pathname === path;

  return (
    <header className="topbar">
      {/* Logo */}
      <div className="topbar__brand" >
        <img src={logo} alt="Logo" className="brand-logo" />
        <span className="brand-text">Datadictos</span>
      </div>

      {/* Boutons centrés */}
      <nav className="topbar__nav">
        <button
          className={`link ${isActive('/') ? 'is-active' : ''}`}
          onClick={() => navigate('/')}
        >
          Accueil
        </button>
        <button
          className={`link ${isActive('/Dashboard') ? 'is-active' : ''}`}
          onClick={() => navigate('/Dashboard')}
        >
          Tableau De Bord
        </button>
        <button
          className={`link ${isActive('/upload') ? 'is-active' : ''}`}
          onClick={() => navigate('/upload')}
        >
          Nouvelle proposition
        </button>
        <button
          className={`link ${isActive('/generation') ? 'is-active' : ''}`}
          onClick={() => navigate('/generation')}
        >
          Assistant IA
        </button>
        <button
          className={`link ${isActive('/data') ? 'is-active' : ''}`}
          onClick={() => navigate('/data')}
        >
          Espace Données
        </button>
        <button
          className={`link ${isActive('/Setting') ? 'is-active' : ''}`}
          onClick={() => navigate('/Setting')}
        >
          Paramètres
        </button>
      </nav>
    </header>
  );
}
