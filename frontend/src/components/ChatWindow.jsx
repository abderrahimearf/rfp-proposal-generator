// frontend/src/components/ChatWindow.jsx

import React, { useEffect, useRef, useState } from 'react';
import InstructionInput from './InstructionInput';
import ReactMarkdown from 'react-markdown'; // <-- 1. AJOUTÉ : Importer la bibliothèque

export default function ChatWindow({ messages, value, onChange, onSend, placeholder }) {
  const listRef = useRef(null);

  // Fait défiler la liste des messages vers le bas automatiquement
  useEffect(() => {
    const listEl = listRef.current;
    if (listEl) {
      listEl.scrollTop = listEl.scrollHeight;
    }
  }, [messages]);

  // Petit composant interne pour gérer la création de l'URL de l'image
  const MessageImage = ({ file }) => {
    const [imageUrl, setImageUrl] = useState('');

    useEffect(() => {
      if (file instanceof File) {
        const url = URL.createObjectURL(file);
        setImageUrl(url);
        // Nettoie l'URL de l'objet pour éviter les fuites de mémoire
        return () => URL.revokeObjectURL(url);
      }
    }, [file]);

    if (!imageUrl) return null;
    return <img src={imageUrl} alt="Contenu envoyé" className="message-image" />;
  };

  return (
    <div className="chat-window">
     
      <div className="message-list" ref={listRef}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            {/* Si le message a une image, on l'affiche */}
            {msg.image && <MessageImage file={msg.image} />}
            
            {/* Si le message a du texte, on l'affiche EN UTILISANT ReactMarkdown */}
            {/* vvv 2. MODIFIÉ : C'est la ligne qui corrige tout vvv */}
            {msg.content && <ReactMarkdown>{msg.content}</ReactMarkdown>}
          </div>
        ))}
      </div>
      
      {/* Affiche la zone de saisie */}
      <InstructionInput
        value={value}
        onChange={onChange}
        onSend={onSend}
        disabled={false}
        placeholder={placeholder}
      />
    </div>
  );
}