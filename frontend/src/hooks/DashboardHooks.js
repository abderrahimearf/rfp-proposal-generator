// src/hooks/DashboardHooks.js
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../api/auth';          // ← ajuste le chemin si besoin
import { useAuth } from '../auth/AuthContext';   // ← ajuste le chemin si besoin

/* =========================================================
   Helpers (communs)
   ========================================================= */

function pageToRange(pagination) {
  const from = (pagination.page - 1) * pagination.pageSize;
  const to = from + pagination.pageSize - 1;
  return { from, to };
}

function applyCommonFilters(query, table, filters = {}) {
  let q = query;
  const f = { ...filters };

  // Recherche simple
  if (f.search && f.search.trim()) {
    const s = `%${f.search.trim()}%`;
    if (table === 'templates') {
      q = q.or(`name.ilike.${s},description.ilike.${s}`);
    } else if (table === 'documents') {
      q = q.or(`nom.ilike.${s},client.ilike.${s},secteur.ilike.${s},file_name.ilike.${s}`);
    } else {
      q = q.or(`nom_document.ilike.${s},client.ilike.${s},secteur.ilike.${s},file_name.ilike.${s}`);
    }
  }

  // Filtres communs
  if (f.client && f.client.trim()) q = q.ilike('client', `%${f.client.trim()}%`);
  if (f.secteur && f.secteur.trim()) q = q.eq('secteur', f.secteur.trim());

  // Fenêtre temporelle (colonne différente selon table)
  const dateCol = table === 'documents' ? 'created_at'
                  : table === 'propositions' ? 'date_proposition'
                  : 'created_at'; // templates
  if (f.dateMin) q = q.gte(dateCol, f.dateMin);
  if (f.dateMax) q = q.lte(dateCol, f.dateMax);

  // Spécifiques propositions
  if (table === 'propositions') {
    if (f.taille) q = q.eq('taille', f.taille);
    if (f.statut) q = q.eq('statut', f.statut);
  }

  return q;
}

function applyUserFilter(query, table, userId) {
  let q = query;
  if (!userId) return q;
  if (table === 'documents' || table === 'propositions') {
    q = q.eq('user_id', userId);
  }
  // templates: tu peux filtrer par created_by si tu veux
  return q;
}

/* =========================================================
   DOCUMENTS — 3 hooks
   ========================================================= */

// 1) Liste paginée
export function useDocumentsList(filters, pagination, orderBy) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) { setData([]); setTotal(0); setLoading(false); return; }

      setLoading(true); setError(null);
      const { from, to } = pageToRange(pagination);

      try {
        // total
        let headQ = supabase.from('documents').select('id', { count: 'exact', head: true });
        headQ = applyUserFilter(headQ, 'documents', userId);
        headQ = applyCommonFilters(headQ, 'documents', filters);
        const headRes = await headQ;
        if (headRes.error) throw headRes.error;
        if (!cancelled) setTotal(headRes.count ?? 0);

        // page
        let pageQ = supabase
          .from('documents')
          .select('id, nom, client, secteur, file_name, size_bytes, created_at')
          .range(from, to);
        pageQ = applyUserFilter(pageQ, 'documents', userId);
        pageQ = applyCommonFilters(pageQ, 'documents', filters);
        pageQ = pageQ.order(orderBy?.column ?? 'created_at', { ascending: orderBy?.ascending ?? false });

        const pageRes = await pageQ;
        if (pageRes.error) throw pageRes.error;
        if (!cancelled) setData(pageRes.data ?? []);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, JSON.stringify(filters), pagination.page, pagination.pageSize, orderBy?.column, orderBy?.ascending]);

  return { data, total, loading, error };
}

// 2) Compteur filtré
export function useDocumentsCount(filters) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) { setCount(0); setLoading(false); return; }
      setLoading(true); setError(null);

      let q = supabase.from('documents').select('id', { count: 'exact', head: true });
      q = applyUserFilter(q, 'documents', userId);
      q = applyCommonFilters(q, 'documents', filters);

      const { count: c, error: err } = await q;
      if (!cancelled) {
        if (err) setError(err);
        setCount(c ?? 0);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, JSON.stringify(filters)]);

  return { count, loading, error };
}

// 3) Groupé par secteur
export function useDocumentsBySecteur(filters) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [bySecteur, setBySecteur] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) { setBySecteur({}); setLoading(false); return; }
      setLoading(true); setError(null);

      let q = supabase.from('documents').select('secteur');
      q = applyUserFilter(q, 'documents', userId);
      q = applyCommonFilters(q, 'documents', filters);

      const { data, error: err } = await q;
      if (err) {
        if (!cancelled) setError(err);
      } else {
        const map = {};
        (data ?? []).forEach(row => {
          const key = row.secteur ?? 'Inconnu';
          map[key] = (map[key] || 0) + 1;
        });
        if (!cancelled) setBySecteur(map);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, JSON.stringify(filters)]);

  return { bySecteur, loading, error };
}

/* =========================================================
   PROPOSITIONS — 3 hooks
   ========================================================= */

// 1) Liste paginée
export function usePropositionsList(filters, pagination, orderBy) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) { setData([]); setTotal(0); setLoading(false); return; }

      setLoading(true); setError(null);
      const { from, to } = pageToRange(pagination);

      try {
        // total
        let headQ = supabase.from('propositions').select('id', { count: 'exact', head: true });
        headQ = applyUserFilter(headQ, 'propositions', userId);
        headQ = applyCommonFilters(headQ, 'propositions', filters);
        const headRes = await headQ;
        if (headRes.error) throw headRes.error;
        if (!cancelled) setTotal(headRes.count ?? 0);

        // page
        let pageQ = supabase
          .from('propositions')
          .select('id, nom_document, client, secteur, date_proposition, budget, statut, taille, created_at')
          .range(from, to);
        pageQ = applyUserFilter(pageQ, 'propositions', userId);
        pageQ = applyCommonFilters(pageQ, 'propositions', filters);
        pageQ = pageQ.order(orderBy?.column ?? 'created_at', { ascending: orderBy?.ascending ?? false });

        const pageRes = await pageQ;
        if (pageRes.error) throw pageRes.error;
        if (!cancelled) setData(pageRes.data ?? []);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
  }, [userId, JSON.stringify(filters), pagination.page, pagination.pageSize, orderBy?.column, orderBy?.ascending]);

  return { data, total, loading, error };
}

// 2) KPIs (total, en_cours=Active projects, validé, somme budgets validés)
export function usePropositionsKpis(filters) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [kpis, setKpis] = useState({
    count: 0,
    countEnCours: 0,
    countValide: 0,
    sumBudgetValide: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) { setKpis({ count: 0, countEnCours: 0, countValide: 0, sumBudgetValide: 0 }); setLoading(false); return; }

      setLoading(true); setError(null);

      try {
        // total
        let headQ = supabase.from('propositions').select('id', { count: 'exact', head: true });
        headQ = applyUserFilter(headQ, 'propositions', userId);
        headQ = applyCommonFilters(headQ, 'propositions', filters);
        const headRes = await headQ;
        if (headRes.error) throw headRes.error;
        const total = headRes.count ?? 0;

        // agrégations légères
        let dataQ = supabase.from('propositions').select('statut, budget');
        dataQ = applyUserFilter(dataQ, 'propositions', userId);
        dataQ = applyCommonFilters(dataQ, 'propositions', filters);
        const { data, error: err } = await dataQ;
        if (err) throw err;

        let enCours = 0, valide = 0, sumValide = 0;
        (data ?? []).forEach(r => {
          if (r.statut === 'en_cours') enCours += 1;
          if (r.statut === 'valide') { valide += 1; sumValide += Number(r.budget ?? 0); }
        });

        if (!cancelled) setKpis({ count: total, countEnCours: enCours, countValide: valide, sumBudgetValide: sumValide });
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, JSON.stringify(filters)]);

  return { ...kpis, loading, error };
}

// 3) Découpages : par taille + Top 3 secteurs
export function usePropositionsBreakdowns(filters) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [byTaille, setByTaille] = useState({ Startup: 0, PME: 0, Grande_entreprise: 0 });
  const [topSecteurs, setTopSecteurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) { setByTaille({ Startup: 0, PME: 0, Grande_entreprise: 0 }); setTopSecteurs([]); setLoading(false); return; }
      setLoading(true); setError(null);

      let q = supabase.from('propositions').select('taille, secteur');
      q = applyUserFilter(q, 'propositions', userId);
      q = applyCommonFilters(q, 'propositions', filters);

      const { data, error: err } = await q;
      if (err) {
        if (!cancelled) setError(err);
      } else {
        const tailleMap = { Startup: 0, PME: 0, Grande_entreprise: 0 };
        const secteurMap = {};
        (data ?? []).forEach(row => {
          const t = row.taille ?? 'PME';
          if (t in tailleMap) tailleMap[t] += 1;
          const s = row.secteur ?? 'Inconnu';
          secteurMap[s] = (secteurMap[s] || 0) + 1;
        });

        const secteurs = Object.entries(secteurMap)
          .map(([secteur, count]) => ({ secteur, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);

        if (!cancelled) { setByTaille(tailleMap); setTopSecteurs(secteurs); }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, JSON.stringify(filters)]);

  return { byTaille, topSecteurs, loading, error };
}

/* =========================================================
   TEMPLATES — 3 hooks
   ========================================================= */

// 1) Liste paginée
export function useTemplatesList(filters, pagination, orderBy) {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      const { from, to } = pageToRange(pagination);

      try {
        // total
        let headQ = supabase.from('templates').select('id', { count: 'exact', head: true });
        headQ = applyCommonFilters(headQ, 'templates', filters);
        const headRes = await headQ;
        if (headRes.error) throw headRes.error;
        if (!cancelled) setTotal(headRes.count ?? 0);

        // page
        let pageQ = supabase
          .from('templates')
          .select('id, name, description, created_by, created_at')
          .range(from, to);
        pageQ = applyCommonFilters(pageQ, 'templates', filters);
        pageQ = pageQ.order(orderBy?.column ?? 'name', { ascending: orderBy?.ascending ?? true });

        const pageRes = await pageQ;
        if (pageRes.error) throw pageRes.error;
        if (!cancelled) setData(pageRes.data ?? []);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
  }, [JSON.stringify(filters), pagination.page, pagination.pageSize, orderBy?.column, orderBy?.ascending]);

  return { data, total, loading, error };
}

// 2) Compteur filtré
export function useTemplatesCount(filters) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      let q = supabase.from('templates').select('id', { count: 'exact', head: true });
      q = applyCommonFilters(q, 'templates', filters);
      const { count: c, error: err } = await q;
      if (!cancelled) {
        if (err) setError(err);
        setCount(c ?? 0);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [JSON.stringify(filters)]);

  return { count, loading, error };
}

// 3) Usage des templates (propositions générées depuis un template)
// ⚠ Si ta table `propositions` n'a pas la colonne `source_template_id`,
// ce hook renverra 0 et une liste vide, sans planter.
// Remplace ENTIEREMENT le hook existant par ceci
export function useTemplatesUsage(filters) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [propositionsGenerees, setPropositionsGenerees] = useState(0);
  const [usageByTemplate, setUsageByTemplate] = useState([]); // on le garde vide pour compat
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        // On compte les propositions dont nom_document = "Generer par platforme"
        let q = supabase
  .from('propositions')
  .select('id', { count: 'exact', head: true })
  .is('budget', null);   // strict

        // Si tu veux être tolérant à la casse/variantes mineures, remplace par:
        // .ilike('nom_document', 'generer par platforme')

        if (userId) q = q.eq('user_id', userId);
        q = applyCommonFilters(q, 'propositions', filters);

        const { count, error: err } = await q;
        if (err) throw err;

        if (!cancelled) {
          setPropositionsGenerees(count ?? 0);
          setUsageByTemplate([]); // pas de breakdown par template dans cette définition
        }
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, JSON.stringify(filters)]);

  return { propositionsGenerees, usageByTemplate, loading, error };
}


/* =========================================================
   SELECTOR optionnel — Top 3 secteurs à partir des documents
   ========================================================= */

export function useTop3SecteursFromDocuments(filters) {
  const { bySecteur, loading, error } = useDocumentsBySecteur(filters);
  const top3 = useMemo(() => {
    return Object.entries(bySecteur)
      .map(([secteur, count]) => ({ secteur, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [bySecteur]);
  return { top3, loading, error };
}
