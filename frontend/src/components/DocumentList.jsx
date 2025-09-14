// frontend/src/components/DocumentList.jsx (VERSION MISE À JOUR)

import React from 'react';

function formatDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString();
}

export default function DocumentList({ documents, onDelete, onDownload }) {
  if (!documents || !documents.length) {
    return (
      <div className="card"><p className="muted">Aucun document pour le moment.</p></div>
    );
  }

  return (
    <div className="card">
      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Nom du document</th>
              <th>Client</th>
              <th>Secteur</th>
              <th>Fichier original</th>
              <th>Date d'ajout</th>
              <th style={{ width: 220 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id}>
                <td>{doc.nom}</td>
                <td>{doc.client}</td>
                <td>{doc.secteur}</td>
                <td>
                  <button className="link" onClick={() => onDownload(doc.storage_path, doc.file_name)}>
                    {doc.file_name}
                  </button>
                </td>
                <td>{formatDate(doc.created_at)}</td>
                <td>
                  <div className="row-actions">
                    <button className="btn small" onClick={() => onDownload(doc.storage_path, doc.file_name)}>Télécharger</button>
                    <button className="btn danger small" onClick={() => onDelete(doc.id, doc.storage_path)} title="Supprimer">Supprimer</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}