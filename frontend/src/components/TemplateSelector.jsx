import React from 'react';

// --- MODIFIÉ : On reçoit 'templates' qui est maintenant un TABLEAU D'OBJETS ---
// Exemple : [{id: "tmpl_001", name: "Proposition Commerciale"}, ...]
export default function TemplateSelector({ templates, selectedId, onChange }) {

  // --- MODIFIÉ : On vérifie directement si le tableau est vide ---
  if (!templates || !templates.length) {
    return (
      <div className="template-selector empty">
        Aucun modèle disponible.
      </div>
    );
  }

  return (
    <div
      className="template-selector"
      role="radiogroup"
      aria-label="Sélectionnez un modèle"
    >
      <label className="selector-label">  Templates </label>

      <div className="buttons-container">
        {/* --- MODIFIÉ : On map directement sur le tableau 'templates' --- */}
        {templates.map((template, idx) => (
          <button
            // La clé est l'ID du template
            key={template.id}
            type="button"
            role="radio"
            // On vérifie si l'ID du template courant correspond à l'ID sélectionné
            aria-checked={template.id === selectedId}
            // On applique la classe 'active' si c'est le cas
            className={`temp-button${template.id === selectedId ? ' active' : ''}`}
            // Au clic, on appelle la fonction onChange avec l'ID du template
            onClick={() => onChange(template.id)}
            onKeyDown={(e) => {
              if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
              e.preventDefault();
              const nextIdx =
                e.key === 'ArrowRight'
                  ? (idx + 1) % templates.length
                  : (idx - 1 + templates.length) % templates.length;
              
              // --- MODIFIÉ : On récupère l'ID du template suivant dans notre tableau ---
              onChange(templates[nextIdx].id);
            }}
          >
            {/* On affiche le nom du template */}
            {template.name}
          </button>
        ))}
      </div>
    </div>
  );
}