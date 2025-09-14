import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

/**
 * PrivateRoute : protège une route par login et éventuellement par rôle.
 *
 * @param {JSX.Element} children - Composant enfant (la page protégée)
 * @param {Array<string>} roles - Rôles autorisés (ex: ['admin'])
 */
export default function PrivateRoute({ children, roles }) {
  const { session, profile, loading } = useAuth();

  // Pendant le chargement, on évite de "flasher"
  if (loading) return <p>Chargement...</p>;

  // Si pas connecté → redirection vers /auth
  if (!session) return <Navigate to="/" replace />;

  // Si la route est restreinte à certains rôles et que le rôle ne correspond pas
  if (roles && profile && !roles.includes(profile.role)) {
    return <p>Accès refusé</p>;
  }

  // Sinon, accès OK
  return children;
}
