// frontend/src/components/DocumentForm.jsx (VERSION MISE À JOUR)

import React, { useState } from 'react';

export default function DocumentForm({ onSave, onCancel }) {
  const [file, setFile] = useState(null);
  const [nom, setNom] = useState('');
  const [client, setClient] = useState('');
  const [secteur, setSecteur] = useState('');
  const [err, setErr] = useState('');

  const onSubmit = (e) => {
    e.preventDefault();
    setErr('');
    if (!file) return setErr('Veuillez sélectionner un fichier.');
    if (!nom.trim()) return setErr('Le nom du document est requis.');
    if (!client.trim()) return setErr('Le client est requis.');
    if (!secteur.trim()) return setErr('Le secteur est requis.');
    
    // onSave attend maintenant le fichier ET les métadonnées
    onSave({ file, nom, client, secteur });
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Ajouter un document</h3>
        <form onSubmit={onSubmit} className="form">
          <div className="field">
            <label>Fichier</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
            {file && <small className="muted">{file.name}</small>}
          </div>

          <div className="grid">
            <div className="field">
              <label>Nom du document</label>
              <input type="text" placeholder="Ex: Contrat de service 2025" value={nom} onChange={(e) => setNom(e.target.value)} required />
            </div>
            <div className="field">
              <label>Client</label>
              <input type="text" placeholder="Ex: ACME SARL" value={client} onChange={(e) => setClient(e.target.value)} required />
            </div>
            <div className="field">
              <label>Secteur</label>
              <input type="text" placeholder="Ex: Informatique" value={secteur} onChange={(e) => setSecteur(e.target.value)} required />
            </div>
          </div>

          {err && <div className="error">{err}</div>}

          <div className="actions">
            <button type="button" className="btn" onClick={onCancel}>Annuler</button>
            <button type="submit" className="btn primary">Enregistrer</button>
          </div>
        </form>
      </div>
    </div>
  );
}