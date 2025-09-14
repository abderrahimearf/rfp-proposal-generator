import React, { useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { ResizableImage } from 'tiptap-extension-resizable-image';
import './TiptapEditor.css';

// --- Les composants TableGridSelector et MenuBar restent inchangés ---
const TableGridSelector = ({ onSelect }) => { /* ... votre code existant ... */ };

const MenuBar = ({ editor }) => {
  const fileInputRef = useRef(null);
  const [isTableGridOpen, setIsTableGridOpen] = useState(false);

  // ==============================================================================
  // FONCTION D'UPLOAD D'IMAGE - VERSION FINALE ET ROBUSTE
  // ==============================================================================
  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file || !editor) {
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const src = reader.result;
      if (src) {
        // On utilise l'API de bas niveau de l'éditeur pour une insertion directe et fiable
        const { state } = editor.view;
        const { schema, tr } = state;
        
        // On crée un "nœud" d'image en utilisant le schéma de l'éditeur
        // 'resizable-image' est le nom que l'extension enregistre
        const node = schema.nodes['resizable-image'].create({ src: src });

        // On crée une transaction pour insérer le nœud à la position du curseur
        const transaction = tr.replaceSelectionWith(node);
        
        // On exécute la transaction pour mettre à jour l'éditeur
        editor.view.dispatch(transaction);
      }
    };
    reader.readAsDataURL(file);
  };
  
  const handleTableSelect = ({ rows, cols }) => { /* ... votre code existant ... */ };
  
  if (!editor) return null;

  return (
    <div className="tiptap-menu-bar">
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} />
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'is-active' : ''}>Gras</button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'is-active' : ''}>Italique</button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}>Titre</button>
      <button type="button" onClick={() => fileInputRef.current?.click()}>Ajouter Image</button>
      <div className="table-inserter-wrapper">
        <button type="button" onClick={() => setIsTableGridOpen(!isTableGridOpen)}>Insérer Tableau</button>
        {isTableGridOpen && <TableGridSelector onSelect={handleTableSelect} />}
      </div>
      {editor.isActive('table') && (
        <>
          <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()}>Ajouter Colonne</button>
          <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()}>Ajouter Ligne</button>
          <button type="button" onClick={() => editor.chain().focus().deleteTable().run()}>Suppr. Tableau</button>
        </>
      )}
    </div>
  );
};


// --- Composant principal de l'éditeur Tiptap (INCHANGÉ) ---
const TiptapEditor = ({ initialContent, onContentChange }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ image: false }),
      ResizableImage, // Cette extension enregistre le nœud 'resizable-image'
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell,
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      onContentChange(editor.getHTML());
    },
  });

  return (
    <div className="tiptap-container">
      <MenuBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};

export default TiptapEditor;