// C:\Users\DHM\Downloads\projetF\frontend\src\api\auth.js
import { createClient } from '@supabase/supabase-js';

// Assure-toi d'avoir ces variables dans ton .env(.local)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


 
export async function signUpWithEmailPassword(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
 
  });

  return { data, error };
}


export async function signInWithEmailPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}


export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}


export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  return { data, error };
}

/** Écouter les changements d’auth (login/logout/refresh) */
export function onAuthStateChange(callback) {
  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => sub.subscription.unsubscribe();
}

/** Lire le rôle de l’utilisateur courant depuis public.profiles (colonne 'role') */
export async function getMyRole() {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) return { role: null, error: userErr };
  const user = userRes?.user;
  if (!user) return { role: null, error: null };

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error) return { role: null, error };
  return { role: data.role, error: null }; // 'admin' | 'user'
}

/** (Optionnel) Récupérer le profil complet si besoin */
export async function getMyProfile() {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return { profile: null, error: null };

  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,role,created_at')
    .eq('id', user.id)
    .single();

  return { profile: data ?? null, error };
}
