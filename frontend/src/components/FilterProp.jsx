import React from 'react';

export default function FilterProp({
  nom,
  onChangeNom,
  client,
  onChangeClient,
  secteur,
  onChangeSecteur,
  taille,
  onChangeTaille,
  budgetMax,
  onChangeBudgetMax,
  onClear,
}) {
  return (
    <div className="card filter">
      <div className="grid grid-3">
        <div className="field">
          <label htmlFor="f-nom">Nom du document</label>
          <input
            id="f-nom"
            className="input"
            type="text"
            placeholder="Rechercher par nom…"
            value={nom}
            onChange={(e) => onChangeNom(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="f-client">Client</label>
          <input
            id="f-client"
            className="input"
            type="text"
            placeholder="Rechercher par client…"
            value={client}
            onChange={(e) => onChangeClient(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="f-secteur">Secteur</label>
          <input
            id="f-secteur"
            className="input"
            type="text"
            placeholder="Rechercher par secteur…"
            value={secteur}
            onChange={(e) => onChangeSecteur(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="f-taille">Taille</label>
          <select
            id="f-taille"
            className="input"
            value={taille}
            onChange={(e) => onChangeTaille(e.target.value)}
          >
            <option value="">Toutes</option>
            <option value="Startup">Startup</option>
            <option value="PME">PME</option>
            <option value="Grande_entreprise">Grande entreprise</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="f-bmax">Budget max (€)</label>
          <input
            id="f-bmax"
            className="input"
            type="number"
            step="0.01"
            value={budgetMax}
            onChange={(e) => onChangeBudgetMax(e.target.value)}
          />
        </div>
      </div>

      <div className="filter-actions">
        <button className="btn" onClick={onClear}>
          Effacer les filtres
        </button>
      </div>
    </div>
  );
}
