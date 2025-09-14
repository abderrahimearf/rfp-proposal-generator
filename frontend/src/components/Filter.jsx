// frontend/src/components/Filter.jsx (VERSION MISE À JOUR)

import React from 'react';

export default function Filter({ nom, onChangeNom, client, onChangeClient, secteur, onChangeSecteur, onClear }) {
  return (
    <div className="card filter">
      <div className="grid grid-3"> {/* Utilise une grille à 3 colonnes */}
        <div className="field">
          <label htmlFor="f-nom">Nom du document</label>
          <input id="f-nom" type="text" placeholder="Rechercher par nom…" value={nom} onChange={(e) => onChangeNom(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="f-client">Client</label>
          <input id="f-client" type="text" placeholder="Rechercher par client…" value={client} onChange={(e) => onChangeClient(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="f-secteur">Secteur</label>
          <input id="f-secteur" type="text" placeholder="Rechercher par secteur…" value={secteur} onChange={(e) => onChangeSecteur(e.target.value)} />
        </div>
      </div>
      <div className="filter-actions">
        <button className="btn" onClick={onClear}>Effacer les filtres</button>
      </div>
    </div>
  );
}