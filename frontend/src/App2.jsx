// App2.jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Header from './components/Header';
import Filter from './components/Filter';
import DocumentForm from './components/DocumentForm';
import DocumentList from './components/DocumentList';
import TemplateForm from './components/TemplateForm';
import FilterProp from './components/FilterProp';
import './App2.css';

import StyledAlert from './components/StyledAlert';

import { supabase, signOut } from './api/auth';
import { useAuth } from './auth/AuthContext';
import { useNavigate } from 'react-router-dom';

const DOCUMENTS_BUCKET = 'Documents';
const PROPOSITIONS_BUCKET = 'propositions';

/** =========================================================================
 * Util: lecture robuste de l'URL backend (Vite, CRA, ou variable globale)
 * ========================================================================= */
function getBackendUrl() {
  const envUrl =
    // Vite
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) ||
    // CRA (Webpack)
    (typeof process !== 'undefined' && process.env && process.env.REACT_APP_BACKEND_URL) ||
    // Fallback global (ex: injecté dans index.html)
    (typeof window !== 'undefined' && window.__BACKEND_URL__) ||
    '';

  const raw = String(envUrl || '').trim();
  if (!raw) {
    throw new Error('Backend non configuré (VITE_BACKEND_URL / REACT_APP_BACKEND_URL / window.__BACKEND_URL__).');
  }

  const url = raw.replace(/\/+$/, '');
  const isHttpsPage = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
  const isLocalBackend = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url);

  // Évite le "mixed content" en prod (autorise http://localhost en dev)
  if (isHttpsPage && url.startsWith('http://') && !isLocalBackend) {
    throw new Error("Mixed content: l'app est en HTTPS mais le backend est en HTTP. Servez le backend en HTTPS ou utilisez un reverse proxy.");
  }

  return url;
}

/* =========================
   VUE : DOCUMENTS
   ========================= */
const DocumentsView = ({ user, showAlert }) => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [nomFiltre, setNomFiltre] = useState('');
  const [clientFiltre, setClientFiltre] = useState('');
  const [secteurFiltre, setSecteurFiltre] = useState('');

  const fetchDocuments = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocs(data || []);
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les documents. Vérifiez vos policies RLS.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const handleAdd = async ({ file, nom, client, secteur }) => {
    if (!file || !user) return;
    try {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(filePath, file);
      if (upErr) throw new Error(`Upload storage [${DOCUMENTS_BUCKET}] : ${upErr.message}`);

      const { error: dbErr } = await supabase.from('documents').insert({
        nom: nom.trim(),
        client: client.trim(),
        secteur: secteur.trim(),
        storage_path: filePath,
        file_name: file.name,
        user_id: user.id,
        mime_type: file.type ?? null,
        size_bytes: file.size ?? null
      });
      if (dbErr) throw dbErr;

      showAlert({ type: 'success', title: 'Succès', message: 'Le document a été ajouté.' });
      await fetchDocuments();
      setFormOpen(false);
    } catch (err) {
      console.error(err);
      showAlert({ type: 'error', title: "Erreur d'ajout", message: String(err.message ?? err) });
    }
  };

  const confirmDelete = async (id, path) => {
    try {
      await supabase.from('documents').delete().match({ id, user_id: user.id });
      const { error: rmErr } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
      if (rmErr) throw rmErr;
      setDocs(prev => prev.filter(d => d.id !== id));
      showAlert({ type: 'success', title: 'Supprimé', message: 'Le document a bien été supprimé.' });
    } catch (err) {
      console.error(err);
      showAlert({ type: 'error', title: 'Erreur de suppression', message: `La suppression a échoué : ${err.message ?? err}` });
    }
  };

  const requestDelete = (id, path) => {
    showAlert({
      type: 'confirm',
      title: 'Confirmer la suppression',
      message: 'Cette action est irréversible. Voulez-vous vraiment supprimer ce document ?',
      confirmLabel: 'Oui, supprimer',
      onConfirm: () => confirmDelete(id, path)
    });
  };

  const handleDownload = async (filePath, fileName) => {
    try {
      const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).download(filePath);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      showAlert({ type: 'error', title: 'Erreur', message: 'Le téléchargement a échoué.' });
    }
  };

  const clearFilters = () => { setNomFiltre(''); setClientFiltre(''); setSecteurFiltre(''); };

  const filteredDocs = useMemo(() => {
    const nf = nomFiltre.trim().toLowerCase();
    const cf = clientFiltre.trim().toLowerCase();
    const sf = secteurFiltre.trim().toLowerCase();
    if (!nf && !cf && !sf) return docs;
    return docs.filter(d =>
      (d.nom ?? '').toLowerCase().includes(nf) &&
      (d.client ?? '').toLowerCase().includes(cf) &&
      (d.secteur ?? '').toLowerCase().includes(sf)
    );
  }, [docs, nomFiltre, clientFiltre, secteurFiltre]);

  return (
    <>
      <div className="toolbar" style={styles.toolbar}>
        <h1 className="page-title" style={styles.pageTitle}>Mes Appels D’offres</h1>
        <button className="btn btn-primary" style={styles.btnPrimary} onClick={() => setFormOpen(true)}>+ Ajouter un document</button>
      </div>
      <Filter
        nom={nomFiltre} onChangeNom={setNomFiltre}
        client={clientFiltre} onChangeClient={setClientFiltre}
        secteur={secteurFiltre} onChangeSecteur={setSecteurFiltre}
        onClear={clearFilters}
      />
      {formOpen && <DocumentForm onCancel={() => setFormOpen(false)} onSave={handleAdd} />}
      {loading && <div className="loading-indicator">Chargement...</div>}
      {error && <div className="error-message">{error}</div>}
      {!loading && !error && (
        <DocumentList
          documents={filteredDocs}
          onDelete={requestDelete}
          onDownload={handleDownload}
        />
      )}
    </>
  );
};

/* =========================
   VUE : PROPOSITIONS
   ========================= */
function PropositionsFormModal({ onSave, onCancel }) {
  const [file, setFile] = useState(null);
  const [nom, setNom] = useState('');
  const [client, setClient] = useState('');
  const [secteur, setSecteur] = useState('');
  const [dateProp, setDateProp] = useState('');
  const [statut, setStatut] = useState('en_cours');
  const [taille, setTaille] = useState('Startup');
  const [budget, setBudget] = useState('');
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErrMsg('');
    if (!file) return setErrMsg('Sélectionne un fichier.');
    if (!nom.trim() || !client.trim() || !secteur.trim()) return setErrMsg('Nom, Client et Secteur sont obligatoires.');
    setSaving(true);
    try {
      await onSave({
        file, nom, client, secteur,
        date_proposition: dateProp || null,
        statut, taille,
        budget: budget !== '' ? Number(budget) : null
      });
    } catch (err) { setErrMsg(err?.message ?? String(err)); }
    finally { setSaving(false); }
  };

  return (
    <div style={styles.modalBackdrop} onClick={onCancel}>
      <div style={styles.bigModal} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Ajouter une proposition</h2>
        <form onSubmit={submit}>
          <div className="grid grid-3">
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Fichier</label>
              <input className="input" type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
            <div className="field"><label>Nom du document</label><input className="input" value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex: Proposition de solution" /></div>
            <div className="field"><label>Client</label><input className="input" value={client} onChange={e => setClient(e.target.value)} placeholder="Ex: ACME SARL" /></div>
            <div className="field"><label>Secteur</label><input className="input" value={secteur} onChange={e => setSecteur(e.target.value)} placeholder="Ex: Informatique" /></div>
            <div className="field"><label>Date</label><input className="input" type="date" value={dateProp} onChange={e => setDateProp(e.target.value)} /></div>
            <div className="field">
              <label>Statut</label>
              <select className="input" value={statut} onChange={e => setStatut(e.target.value)}>
                <option value="en_cours">En cours</option>
                <option value="valide">Validé</option>
              </select>
            </div>
            <div className="field">
              <label>Taille</label>
              <select className="input" value={taille} onChange={e => setTaille(e.target.value)}>
                <option value="Startup">Startup</option>
                <option value="PME">PME</option>
                <option value="Grande_entreprise">Grande entreprise</option>
              </select>
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Budget (€)</label>
              <input className="input" type="number" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} placeholder="Ex: 150000" />
            </div>
          </div>
          {errMsg && <p className="error-message" style={{ color: '#b91c1c', marginTop: 8 }}>{errMsg}</p>}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 18 }}>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Annuler</button>
            <button className="btn btn-primary" style={styles.btnPrimary} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const PropositionsView = ({ user, showAlert }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [fNom, setFNom] = useState('');
  const [fClient, setFClient] = useState('');
  const [fSecteur, setFSecteur] = useState('');
  const [fTaille, setFTaille] = useState('');
  const [fBudgetMax, setFBudgetMax] = useState('');

  const fetchPropositions = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('propositions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error(err);
      showAlert({ type: 'error', title: 'Erreur', message: `Le chargement des propositions a échoué : ${err.message ?? err}` });
    } finally {
      setLoading(false);
    }
  }, [user?.id, showAlert]);

  useEffect(() => { fetchPropositions(); }, [fetchPropositions]);

  const handleAdd = async (payload) => {
    if (!user || !user.email) {
      const errorMessage = 'Utilisateur non connecté ou email non disponible.';
      showAlert({ type: 'error', title: 'Erreur', message: errorMessage });
      throw new Error(errorMessage);
    }
    let uploadedPath = null;
    try {
      const filePath = `${user.id}/${Date.now()}_${payload.file.name}`;
      const { error: upErr } = await supabase.storage.from(PROPOSITIONS_BUCKET).upload(filePath, payload.file);
      if (upErr) throw new Error(`Échec de l'upload Supabase: ${upErr.message}`);
      uploadedPath = filePath;

      const { error: dbErr } = await supabase.from('propositions').insert({
        user_id: user.id,
        nom_document: payload.nom.trim(),
        client: payload.client.trim(),
        secteur: payload.secteur.trim(),
        date_proposition: payload.date_proposition,
        statut: payload.statut,
        taille: payload.taille,
        budget: payload.budget ?? null,
        storage_path: filePath,
        file_name: payload.file.name,
        mime_type: payload.file.type ?? null,
        size_bytes: payload.file.size ?? null
      });
      if (dbErr) throw new Error(`Échec de l'insertion Supabase: ${dbErr.message}`);

      showAlert({ type: 'success', title: 'Succès', message: "Proposition enregistrée ! Début de l'indexation..." });

      // ----- Appel backend durci -----
      const formData = new FormData();
      formData.append('file', payload.file); // garde l'envoi binaire (si ton backend l'attend)
      formData.append('email', user.email);
      formData.append('file_name', payload.file.name);
      formData.append('storage_path', uploadedPath || '');
      formData.append('client', payload.client);
      formData.append('secteur', payload.secteur);
      formData.append('date_proposition', payload.date_proposition || '');

      const backendUrl = getBackendUrl();

      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 20000);

      let response, rawText;
      try {
        response = await fetch(`${backendUrl}/api/stock-prop`, {
          method: 'POST',
          body: formData,
          signal: ctrl.signal
          // Pas de headers custom => CORS plus simple
        });
        rawText = await response.text();
      } catch (e) {
        clearTimeout(timeout);
        throw new Error(`Appel backend échoué: ${e?.message || e}`);
      } finally {
        clearTimeout(timeout);
      }

      let result;
      try {
        result = rawText ? JSON.parse(rawText) : {};
      } catch {
        result = { raw: rawText };
      }

      if (!response.ok) {
        const detail = result?.error || result?.message || (typeof result === 'string' ? result : '') || 'Erreur inconnue';
        throw new Error(`Indexation Weaviate a échoué (HTTP ${response.status}): ${detail}`);
      }

      console.log("Réponse de l'indexation Weaviate:", result);
      showAlert({ type: 'success', title: 'Indexation terminée', message: 'La proposition a été indexée avec succès.' });
    } catch (err) {
      console.error(err);
      if (uploadedPath && String(err.message || '').includes('Supabase')) {
        try { await supabase.storage.from(PROPOSITIONS_BUCKET).remove([uploadedPath]); } catch (_) { /* ignore */ }
      }
      showAlert({ type: 'error', title: 'Opération échouée', message: `${err.message}` });
      throw err;
    } finally {
      setFormOpen(false);
      await fetchPropositions();
    }
  };

  const confirmDelete = async (id, storagePath) => {
    try {
      const { error: delErr } = await supabase.from('propositions').delete().match({ id, user_id: user.id });
      if (delErr) throw delErr;
      const { error: rmErr } = await supabase.storage.from(PROPOSITIONS_BUCKET).remove([storagePath]);
      if (rmErr) throw rmErr;
      setItems(prev => prev.filter(x => x.id !== id));
      showAlert({ type: 'success', title: 'Supprimé', message: 'La proposition a bien été supprimée.' });
    } catch (err) {
      console.error(err);
      showAlert({ type: 'error', title: 'Erreur', message: `La suppression a échoué : ${err.message ?? err}` });
    }
  };

  const requestDelete = (id, storagePath) => {
    showAlert({
      type: 'confirm',
      title: 'Confirmer la suppression',
      message: 'Voulez-vous vraiment supprimer cette proposition ?',
      onConfirm: () => confirmDelete(id, storagePath),
    });
  };

  const clearFilters = () => { setFNom(''); setFClient(''); setFSecteur(''); setFTaille(''); setFBudgetMax(''); };

  const filtered = useMemo(() => {
    const nom = fNom.trim().toLowerCase();
    const client = fClient.trim().toLowerCase();
    const secteur = fSecteur.trim().toLowerCase();
    const budgetMax = fBudgetMax !== '' ? Number(fBudgetMax) : null;
    return items.filter(it => {
      if (nom && !(it.nom_document ?? '').toLowerCase().includes(nom)) return false;
      if (client && !(it.client ?? '').toLowerCase().includes(client)) return false;
      if (secteur && !(it.secteur ?? '').toLowerCase().includes(secteur)) return false;
      if (fTaille && it.taille !== fTaille) return false;
      if (budgetMax !== null && (it.budget ?? Infinity) > budgetMax) return false;
      return true;
    });
  }, [items, fNom, fClient, fSecteur, fTaille, fBudgetMax]);

  return (
    <>
      <div className="toolbar" style={styles.toolbar}>
        <h1 className="page-title" style={styles.pageTitle}>Mes Propositions</h1>
        <button className="btn btn-primary" style={styles.btnPrimary} onClick={() => setFormOpen(true)}>+ Ajouter une proposition</button>
      </div>

      <FilterProp
        nom={fNom} onChangeNom={setFNom}
        client={fClient} onChangeClient={setFClient}
        secteur={fSecteur} onChangeSecteur={setFSecteur}
        taille={fTaille} onChangeTaille={setFTaille}
        budgetMax={fBudgetMax} onChangeBudgetMax={setFBudgetMax}
        onClear={clearFilters}
      />

      {formOpen && <PropositionsFormModal onSave={handleAdd} onCancel={() => setFormOpen(false)} />}

      {loading ? (
        <div className="loading-indicator">Chargement...</div>
      ) : (
        <div className="documents-list">
          {filtered.map(p => (
            <div key={p.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0 }}>{p.nom_document}</h3>
                  <p className="muted" style={{ margin: '4px 0' }}>
                    Client: <b>{p.client}</b> • Secteur: <b>{p.secteur}</b>
                  </p>
                  <p className="muted" style={{ margin: '4px 0' }}>
                    Date: {p.date_proposition ?? '—'} • Statut: {p.statut} • Taille: {p.taille} • Budget: {p.budget ?? '—'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'start' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={async () => {
                      try {
                        const { data, error } = await supabase.storage.from(PROPOSITIONS_BUCKET).download(p.storage_path);
                        if (error) throw error;
                        const url = URL.createObjectURL(data);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = p.file_name;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                      } catch (err) {
                        console.error(err);
                        showAlert({ type: 'error', title: 'Erreur', message: 'Téléchargement impossible.' });
                      }
                    }}
                  >
                    Télécharger
                  </button>
                  <button className="btn btn-danger" onClick={() => requestDelete(p.id, p.storage_path)}>Supprimer</button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="muted">Aucune proposition.</p>}
        </div>
      )}
    </>
  );
};

/* =========================
   VUE : BIBLIOTHÈQUE
   ========================= */
const TemplatesView = ({ showAlert }) => {
  const { session, profile } = useAuth();
  const role = profile?.role;
  const user = session?.user || null;
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('templates').select('*').order('name');
    if (error) console.error(error);
    setTemplates(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const handleCreate = async (tpl) => {
    if (!user) return;
    const sections = Array.isArray(tpl.sections) ? tpl.sections : [];
    const { data, error } = await supabase
      .from('templates')
      .insert({
        name: tpl.name?.trim() ?? '',
        description: tpl.description ?? '',
        sections,
        created_by: user.id
      })
      .select();
    if (error) return showAlert({ type: 'error', title: 'Erreur', message: 'Création impossible: ' + error.message });
    setTemplates(prev => [...prev, data[0]]);
    setIsFormOpen(false);
    showAlert({ type: 'success', title: 'Succès', message: 'Template créé !' });
  };

  const startEdit = (t) => { setEditingTemplate(t); setIsFormOpen(true); };

  const handleSaveEdit = async (tpl) => {
    if (!editingTemplate) return;
    const sections = Array.isArray(tpl.sections) ? tpl.sections : [];
    const { data, error } = await supabase
      .from('templates')
      .update({
        name: tpl.name?.trim() ?? '',
        description: tpl.description ?? '',
        sections
      })
      .eq('id', editingTemplate.id)
      .select();
    if (error) return showAlert({ type: 'error', title: 'Erreur', message: 'Modification impossible: ' + error.message });
    setTemplates(prev => prev.map(x => x.id === editingTemplate.id ? data[0] : x));
    setIsFormOpen(false);
    setEditingTemplate(null);
    showAlert({ type: 'success', title: 'Succès', message: 'Template modifié.' });
  };

  const handleDelete = (id) => {
    showAlert({
      type: 'confirm',
      title: 'Confirmer la suppression',
      message: 'Voulez-vous vraiment supprimer ce template ? Il sera perdu pour tout le monde.',
      onConfirm: async () => {
        const { error } = await supabase.from('templates').delete().eq('id', id);
        if (error) {
          showAlert({ type: 'error', title: 'Erreur', message: `Suppression impossible: ${error.message}` });
        } else {
          showAlert({ type: 'success', title: 'Succès', message: 'Template supprimé.' });
          refresh();
        }
      }
    });
  };

  const closeForm = () => { setIsFormOpen(false); setEditingTemplate(null); };

  return (
    <>
      <div className="toolbar" style={styles.toolbar}>
        <h1 className="page-title" style={styles.pageTitle}>Mes Templates</h1>
        {role === 'admin' && (
          <button
            className="btn btn-primary"
            style={styles.btnPrimary}
            onClick={() => { setEditingTemplate(null); setIsFormOpen(true); }}
          >
            + Ajouter un template
          </button>
        )}
      </div>

      {isFormOpen && role === 'admin' && (
        <div style={styles.templatesFormWrap}>
          <TemplateForm
            key={editingTemplate ? editingTemplate.id : 'new'}
            onSave={editingTemplate ? handleSaveEdit : handleCreate}
            onCancel={closeForm}
            initialData={editingTemplate ? {
              name: editingTemplate.name,
              description: editingTemplate.description,
              sections: editingTemplate.sections
            } : undefined}
          />
        </div>
      )}

      {loading ? <p>Chargement...</p> : (
        <div className="templates-list">
          {templates.map(t => (
            <div key={t.id} className="card template-card">
              <h3>{t.name}</h3>
              <p className="muted">{t.description}</p>
              <ul>
                {Array.isArray(t.sections) && t.sections.map((s, i) => (
                  <li key={i}><strong>{s.name}:</strong> {s.content}</li>
                ))}
              </ul>
              {role === 'admin' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-secondary" onClick={() => startEdit(t)}>Éditer</button>
                  <button className="btn btn-danger" onClick={() => handleDelete(t.id)}>Supprimer</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

/* =========================
   APP PRINCIPALE
   ========================= */
export default function App2() {
  const { session, loading } = useAuth();
  const user = session?.user || null;
  const nav = useNavigate();
  const [activeView, setActiveView] = useState('propositions');

  const [alertState, setAlertState] = useState({
    open: false,
    type: 'success',
    title: '',
    message: ''
  });

  const showAlert = (config) => {
    const onConfirmAction = config.type === 'confirm'
      ? () => {
          if (config.onConfirm) config.onConfirm();
          closeAlert();
        }
      : null;

    setAlertState({ ...config, open: true, onConfirm: onConfirmAction });
  };

  const closeAlert = () => {
    setAlertState(prev => ({ ...prev, open: false }));
  };

  const handleLogout = async () => {
    await signOut();
    nav('/auth', { replace: true });
  };

  if (loading) {
    return (
      <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header subtitle="" />
        <p style={{ padding: 16 }}>Chargement...</p>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header subtitle="" />
      <nav style={styles.nav}>
        <button
          style={{ ...styles.tab, ...(activeView === 'documents' ? styles.tabActive : {}) }}
          onClick={() => setActiveView('documents')}
        >
          Appels D’offres
        </button>
        <button
          style={{ ...styles.tab, ...(activeView === 'propositions' ? styles.tabActive : {}) }}
          onClick={() => setActiveView('propositions')}
        >
          Propositions
        </button>
        <button
          style={{ ...styles.tab, ...(activeView === 'templates' ? styles.tabActive : {}) }}
          onClick={() => setActiveView('templates')}
        >
          Templates
        </button>
        <div style={{ flex: 1 }} />
        
      </nav>

      <main className="main-content" style={{ flex: 1, padding: 16, overflowY: 'auto', scrollbarGutter: 'stable both-edges' }}>
        {activeView === 'documents' && <DocumentsView user={user} showAlert={showAlert} />}
        {activeView === 'propositions' && <PropositionsView user={user} showAlert={showAlert} />}
        {activeView === 'templates' && <TemplatesView showAlert={showAlert} />}
      </main>

      <StyledAlert
        {...alertState}
        onClose={closeAlert}
      />
    </div>
  );
}

/* =========================
   STYLES INLINE
   ========================= */
const styles = {
  nav: { position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid #e9ecef' },
  tab: { border: '1px solid #cfd4da', background: '#91a9c6ff', padding: '8px 12px', borderRadius: '8px 8px 0 0', fontWeight: 600, cursor: 'pointer', transition: '0.15s ease' },
  tabActive: { background: '#0d6efd', color: '#fff', borderColor: '#0b5ed7', boxShadow: 'inset 0 -2px 0 rgba(255,255,255,0.25)' },
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  pageTitle: { margin: 0 ,color: '#f0ececff'},
  btnPrimary: { background: '#0d6efd', color: '#fff', border: '1px solid #0b5ed7', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' },
  btnSecondary: { padding: '8px 12px', borderRadius: 8, border: '1px solid #cfd4da', background: '#eef2f6', cursor: 'pointer' },
  btnDanger: { padding: '8px 14px', borderRadius: 6, border: '1px solid #c53030', background: '#e53e3e', color: '#fff', cursor: 'pointer' },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 , },
  modal: { background: '#fff', padding: 20, borderRadius: 10, width: 'min(420px, 92vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' },
  bigModal: { background: '#fff', padding: 20, borderRadius: 10, width: 'min(920px, 96vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' },
  templatesFormWrap: { maxHeight: 'calc(100vh - 160px)', overflowY: 'auto', paddingRight: 4 }
};



