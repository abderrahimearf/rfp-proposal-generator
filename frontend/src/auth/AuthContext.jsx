import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../api/auth";   // importe ton client Supabase
import { getSession, onAuthStateChange, getMyProfile } from "../api/auth";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);     // infos de session (user + token)
  const [profile, setProfile] = useState(null);     // profil lié à profiles (email + role)
  const [loading, setLoading] = useState(true);     // true au début → évite les clignotements

  // 1) Charger la session actuelle au démarrage
  useEffect(() => {
    (async () => {
      const { data, error } = await getSession();
      if (!error && data.session) {
        setSession(data.session);
      }
      setLoading(false);
    })();
  }, []);

  // 2) Écouter les changements (login / logout)
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        const { profile } = await getMyProfile();
        setProfile(profile);
      } else {
        setProfile(null);
      }
    });
    return unsubscribe;
  }, []);

  // 3) Charger le profil (rôle) quand session change
  useEffect(() => {
    (async () => {
      if (session?.user) {
        const { profile } = await getMyProfile();
        setProfile(profile);
      }
    })();
  }, [session]);

  return (
    <AuthContext.Provider value={{ session, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
