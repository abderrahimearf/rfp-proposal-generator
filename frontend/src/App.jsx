// src/App.js

import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import TemplateSelector from './components/TemplateSelector';
import DocumentPreview from './components/DocumentPreview';
import ChatWindow from './components/ChatWindow';
import './App.css';

// Importations pour Supabase et l'authentification
import { supabase } from './api/auth';
import { useAuth } from './auth/AuthContext';

// --- Configuration des APIs ---
const API_BASE_URL = 'http://localhost:5000/api';

/* ==============================================================================
   FONCTION UTILITAIRE pour fusionner les mises à jour du document
   ============================================================================== */
function mergeDoc(prev, patch) {
  const next = prev ? { ...prev } : { sections: [] };
  let sections = Array.isArray(next.sections) ? [...next.sections] : [];

  if (patch.titre && patch.contenu !== undefined) {
    const titreNettoye = patch.titre.trim().toLowerCase();
    const idx = sections.findIndex(
      (s) => s?.name?.trim().toLowerCase() === titreNettoye
    );
    if (idx >= 0) {
      sections[idx] = { ...sections[idx], name: patch.titre.trim(), content: patch.contenu };
    } else {
      sections.push({ name: patch.titre.trim(), content: patch.contenu });
    }
  }
  next.sections = sections;
  return next;
}

/* ==============================================================================
   COMPOSANT PRINCIPAL : APP
   ============================================================================== */
export default function App() {
  const { session } = useAuth();

  // --- États persistants (sessionStorage) ---
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState(() => sessionStorage.getItem('selectedId') || '');
  const [doc, setDoc] = useState(() => JSON.parse(sessionStorage.getItem('doc') || 'null'));
  const [messages, setMessages] = useState(() =>
    JSON.parse(sessionStorage.getItem('messages') || '[]')
  );
  const [appMode, setAppMode] = useState(() => sessionStorage.getItem('appMode') || 'idle');
  const [orchestratorSessionId, setOrchestratorSessionId] = useState(() => sessionStorage.getItem('orchestratorSessionId') || null);
  const [chatSessionId, setChatSessionId] = useState(() => sessionStorage.getItem('chatSessionId') || null);

  // --- États non persistants ---
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [docError, setDocError] = useState(null);
  const [templateOriginal, setTemplateOriginal] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [isBotReplying, setIsBotReplying] = useState(false);
  const [companyName, setCompanyName] = useState('');

  // Sauvegarde dans sessionStorage (inchangé)
  useEffect(() => {
    if (doc) sessionStorage.setItem('doc', JSON.stringify(doc)); else sessionStorage.removeItem('doc');
    sessionStorage.setItem('messages', JSON.stringify(messages));
    sessionStorage.setItem('appMode', appMode);
    if (orchestratorSessionId) sessionStorage.setItem('orchestratorSessionId', orchestratorSessionId); else sessionStorage.removeItem('orchestratorSessionId');
    if (chatSessionId) sessionStorage.setItem('chatSessionId', chatSessionId); else sessionStorage.removeItem('chatSessionId');
    if (selectedId) sessionStorage.setItem('selectedId', selectedId); else sessionStorage.removeItem('selectedId');
  }, [doc, messages, appMode, orchestratorSessionId, chatSessionId, selectedId]);

  // Charger la liste des templates (inchangé)
  useEffect(() => {
    if (session) {
      supabase.from('templates').select('id, name').then(({ data, error }) => {
        if (error) console.error('Erreur de chargement des templates:', error);
        else setTemplates(data || []);
      });
    }
  }, [session]);

  // Charger nom_entreprise (inchangé)
  useEffect(() => {
    if (session?.user?.id) {
      supabase.from('parametres').select('nom_entreprise').eq('user_id', session.user.id).single().then(({ data, error }) => {
        if (!error && data?.nom_entreprise) setCompanyName(data.nom_entreprise);
        else setCompanyName('');
      });
    }
  }, [session]);

  // Sélection d'un NOUVEAU template (inchangé)
  const handleSelectTemplate = useCallback((id) => {
    sessionStorage.clear();
    setAppMode('idle'); setOrchestratorSessionId(null); setChatSessionId(null); setCurrentQuestion(null);
    setMessages([]);
    setDoc(null); setTemplateOriginal(null); setSelectedId(id);
  }, []);

  // Charger les détails du template sélectionné (inchangé)
  useEffect(() => {
    if (!selectedId || !session) return;
    const fetchTemplateDetails = async () => {
      setLoadingDoc(true); setDocError(null);
      try {
        const { data, error } = await supabase.from('templates').select('*').eq('id', selectedId).single();
        if (error) throw error;
        setTemplateOriginal(data);
        if (!doc) {
          setDoc(data);
        }
      } catch (error) {
        console.error('Erreur de chargement du template détaillé:', error);
        setDocError('Erreur de chargement du template.');
      } finally { setLoadingDoc(false); }
    };
    fetchTemplateDetails();
  }, [selectedId, session, doc]);

  // MODIFIÉ : Lancer la génération avec user_id
  const lancerGenerationAvecTemplate = useCallback(async (templateToUse) => {
    // MODIFIÉ : On vérifie la présence de l'ID utilisateur, plus robuste que l'email.
    if (!session?.user?.id) {
      console.error("Tentative de génération sans ID utilisateur.");
      setAppMode('idle'); 
      return;
    }
    if (!templateToUse) return;

    setAppMode('generating');
    
    try {
      const response = await fetch(`${API_BASE_URL}/orchestrator/start`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        // MODIFIÉ : Envoi de 'user_id' au lieu de 'email' pour correspondre au backend.
        body: JSON.stringify({ template: templateToUse, user_id: session.user.id }),
      });

      if (!response.ok) throw new Error(`Erreur serveur (${response.status}): ${await response.text()}`);
      
      const data = await response.json();
      if (data.session_id) {
        setOrchestratorSessionId(data.session_id);
      } else {
        throw new Error('ID de session non reçu du serveur.');
      }
    } catch (error) {
      console.error('Erreur au démarrage de la génération:', error);
      setAppMode('idle');
    }
  }, [session]);

  const handleGenerateClick = useCallback(() => {
    if (!templateOriginal) return;
    const placeholderDoc = { ...templateOriginal, sections: (templateOriginal.sections || []).map((s) => ({ ...s, content: 'Génération en cours...' })) };
    setDoc(placeholderDoc);
    lancerGenerationAvecTemplate(templateOriginal);
  }, [templateOriginal, lancerGenerationAvecTemplate]);

  // --- Chat : START (inchangé) ---
  const startChatSession = useCallback(async () => {
    if (!session?.user?.id) {
      return null;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/conversation/chat/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: session.user.id })
      });

      const text = await response.text();
      if (!response.ok) {
        try { throw new Error(JSON.parse(text).error || `Erreur serveur (${response.status})`); }
        catch { throw new Error(`Erreur serveur (${response.status}): ${text}`); }
      }

      const data = JSON.parse(text);
      setChatSessionId(data.chat_session_id);
      return data.chat_session_id;
    } catch (error) {
      console.error("Erreur lors de l'initialisation du chat:", error);
      return null;
    }
  }, [session]);

  // Écoute des événements (SSE) de l'orchestrateur (inchangé)
  useEffect(() => {
    if (appMode !== 'generating' || !orchestratorSessionId) return;
    const eventSource = new EventSource(`${API_BASE_URL}/orchestrator/stream/${orchestratorSessionId}`);

    eventSource.addEventListener('nouvelle_version_section', (e) => setDoc((prev) => mergeDoc(prev, JSON.parse(e.data))));
    eventSource.addEventListener('attente_feedback_utilisateur', (e) => {
      const data = JSON.parse(e.data); setCurrentQuestion(data);
    });
    eventSource.addEventListener('generation_complete', () => {
      eventSource.close();
    });
    eventSource.onerror = () => {
      setAppMode('idle'); eventSource.close();
    };
    return () => eventSource.close();
  }, [orchestratorSessionId, appMode]);

  // Envoi de messages au backend de conversation (inchangé)
  const handleSend = useCallback(async (text, imageFile) => {
    if (!text?.trim() && !imageFile) return;

    const userMessageContent = text.trim();
    setMessages((prev) => [...prev, { role: 'user', content: userMessageContent }]);
    setIsBotReplying(true);

    try {
      let activeChatId = chatSessionId;
      if (!activeChatId) {
        activeChatId = await startChatSession();
        if (!activeChatId) throw new Error("Impossible d'initialiser le chat.");
        setChatSessionId(activeChatId);
      }

      const formData = new FormData();
      formData.append('chat_session_id', activeChatId);
      formData.append('message', userMessageContent);
      if (imageFile) formData.append('image', imageFile);

      const response = await fetch(`${API_BASE_URL}/conversation/send-message`, {
        method: 'POST',
        body: formData,
      });

      const responseText = await response.text();
      if (!response.ok) {
        try { throw new Error(JSON.parse(responseText).error || `Erreur serveur (${response.status})`); }
        catch { throw new Error(`Erreur serveur (${response.status}): ${responseText}`); }
      }

      const data = JSON.parse(responseText);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);

      if (data.action && data.action.action_type === 'update_section') {
        setDoc((prev) => mergeDoc(prev, data.action.payload));
      }
    } catch (error) {
      console.error("Erreur lors de l'envoi du message:", error);
    } finally {
      setIsBotReplying(false);
    }
  }, [chatSessionId, startChatSession]);

  // Placeholder UX (inchangé)
  const getPlaceholder = () => {
    if (!session) return "Veuillez vous connecter pour utiliser l'application.";
    if (!selectedId) return 'Sélectionnez un template (facultatif), vous pouvez déjà chatter.';
    if (isBotReplying) return "L'assistant est en train d'écrire...";
    if (appMode === 'generating') return currentQuestion ? `Répondre à "${currentQuestion.titre}"...` : 'La génération tourne. Vous pouvez chatter en parallèle.';
    if (chatSessionId) return 'Posez une question, modifiez une section...';
    return 'Cliquez sur "Générer" ou commencez à chatter.';
  };

  if (!session) {
    return (
      <div className="app"><div className="main">
        <Header title="Générateur de Documents" subtitle="" />
        <div className="login-prompt">
          <h2>Veuillez vous connecter</h2>
          <p>Vous devez être connecté pour sélectionner des templates et générer des documents.</p>
        </div>
      </div></div>
    );
  }

  return (
    <div className="app">
      <div className="main">
        <Header title="Générateur de Documents" subtitle="" />
        <div className="workspace">
          <div className="side-panel">
            <TemplateSelector templates={templates} selectedId={selectedId} onChange={handleSelectTemplate} />
          </div>
          <div className="content-panel">
            <DocumentPreview
              doc={doc} loading={loadingDoc} error={docError}
              onGenerate={handleGenerateClick} isGenerating={appMode === 'generating'}
              companyName={companyName}
            />
            <ChatWindow
              messages={messages}
              value={inputValue}
              onChange={setInputValue}
              onSend={handleSend}
              placeholder={getPlaceholder()}
              disabled={false}
              extraDisabled={isBotReplying || !session}
            />
          </div>
        </div>
      </div>
    </div>
  );
}