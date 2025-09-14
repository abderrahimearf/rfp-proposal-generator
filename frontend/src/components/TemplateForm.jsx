// frontend/src/components/TemplateForm.jsx
import React, { useState } from 'react';

export default function TemplateForm({ onSave, onCancel }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState([{ name: '', content: '' }]);
  const [err, setErr] = useState('');

  const handleSectionChange = (index, field, value) => {
    const newSections = [...sections];
    newSections[index][field] = value;
    setSections(newSections);
  };
  const addSection = () => setSections([...sections, { name: '', content: '' }]);
  const removeSection = (index) => setSections(sections.filter((_, i) => i !== index));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return setErr('Le nom du template est requis.');
    const finalSections = sections.filter(s => s.name.trim() && s.content.trim());
    if (!finalSections.length) return setErr('Au moins une section complète est requise.');
    onSave({ name, description, sections: finalSections });
  };

  const styles = {
    sectionEditor: {
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      padding: '15px',
      marginBottom: '15px',
      position: 'relative',
      background: '#fff'
    },
    removeButton: { position: 'absolute', top: '10px', right: '10px' }
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        {/* HEADER FIXE */}
        <div className="modal-header">
          <h3 style={{margin:0}}>Ajouter un nouveau template</h3>
        </div>

        {/* BODY SCROLLABLE */}
        <div className="modal-body">
          <form onSubmit={handleSubmit} className="form" /* pas de overflow ici */>
            <div className="field">
              <label>Nom du template</label>
              <input type="text" value={name}
                     onChange={(e) => setName(e.target.value)}
                     placeholder="Ex: Proposition de solution" required />
            </div>

            <div className="field">
              <label>Description</label>
              <textarea value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Courte description du template" />
            </div>

            <hr />
            <h4>Sections du document</h4>

            {sections.map((section, index) => (
              <div style={styles.sectionEditor} key={index}>
                <div className="grid">
                  <div className="field">
                    <label>Titre de la section {index + 1}</label>
                    <input type="text" value={section.name}
                           onChange={(e) => handleSectionChange(index, 'name', e.target.value)}
                           placeholder="Ex: Présentation de l'entreprise" />
                  </div>
                  <div className="field">
                    <label>Contenu / Instruction</label>
                    <input type="text" value={section.content}
                           onChange={(e) => handleSectionChange(index, 'content', e.target.value)}
                           placeholder="Ex: Décrire l'historique et les valeurs..." />
                  </div>
                </div>
                <button type="button"
                        style={styles.removeButton}
                        className="btn danger small"
                        onClick={() => removeSection(index)}>X</button>
              </div>
            ))}

            <button type="button" className="btn" onClick={addSection}>+ Ajouter une section</button>

            {err && <div className="error">{err}</div>}
          </form>
        </div>

        {/* FOOTER FIXE */}
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onCancel}>Annuler</button>
          <button type="submit" className="btn primary" onClick={handleSubmit}>
            Enregistrer le template
          </button>
        </div>
      </div>
    </div>
  );
}
