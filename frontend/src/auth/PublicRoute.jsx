// frontend/src/auth/PublicRoute.jsx

import React from 'react';
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

/**
 * Ce composant protège les routes publiques comme la page de connexion.
 * Si l'utilisateur est déjà authentifié, il est redirigé vers la plateforme
 * pour éviter qu'il ne revoie la page de login inutilement.
 */
export default function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  // On attend de savoir si l'utilisateur est connecté ou non
  if (loading) {
    return <div>Chargement...</div>;
  }

  // Si l'utilisateur est connecté, on le redirige
  if (user) {
    // Redirige vers la page principale de la plateforme
    return <Navigate to="/data" replace />;
  }

  // Si l'utilisateur n'est pas connecté, on affiche la page demandée (Login)
  return children;
}