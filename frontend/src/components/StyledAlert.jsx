// frontend/src/components/StyledAlert.jsx
import React, { useEffect, useRef, useState } from 'react';

export default function StyledAlert({
  open = false,
  type = 'success',               // 'success' | 'error' | 'confirm'
  title = '',
  message = '',
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onClose,
  autoHide = true,
  autoHideMs = 4000,
  position = 'bottom-right',      // 'bottom-right' | 'top-right' | 'top-center'
}) {
  const isConfirm = type === 'confirm';
  const timerRef = useRef(null);
  const [barStart, setBarStart] = useState(false);

  // Auto dismiss (toasts seulement)
  useEffect(() => {
    if (!open || isConfirm || !autoHide) return;
    clearTimeout(timerRef.current);
    setBarStart(false);
    const startT = setTimeout(() => setBarStart(true), 30);
    timerRef.current = setTimeout(() => onClose?.(), autoHideMs);
    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(startT);
    };
  }, [open, isConfirm, autoHide, autoHideMs, onClose]);

  // Raccourcis clavier
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (isConfirm && e.key === 'Enter') {
        e.preventDefault();
        onConfirm?.();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isConfirm, onClose, onConfirm]);

  if (!open) return null;

  // ---------- Toast (success / error) ----------
  if (!isConfirm) {
    return (
      <div className={`styled-alert styled-alert--toast position-${position}`}>
        <div className={`styled-alert-card styled-alert--${type}`}>
          <span className="styled-alert-accent" aria-hidden="true" />
          <div className="styled-alert-row">
            <div className={`styled-alert-icon styled-alert-icon--${type}`} aria-hidden="true">
              {/* icône texte pour accessibilité simple */}
              <span className="styled-alert-icon-char">
                {type === 'success' ? '✓' : '⚠'}
              </span>
            </div>
            <div className="styled-alert-body">
              {title ? <div className="styled-alert-title">{title}
                <span className={`styled-alert-chip styled-alert-chip--${type}`}>{type}</span>
              </div> : null}
              {message ? <div className="styled-alert-text">{message}</div> : null}
            </div>
            <button
              type="button"
              className="styled-alert-close"
              aria-label="Fermer l’alerte"
              onClick={onClose}
            >
              ×
            </button>
          </div>

          {/* barre d’écoulement (animation pilotée par .is-start) */}
          <div className={`styled-alert-progress ${barStart ? 'is-start' : ''}`} />
        </div>
      </div>
    );
  }

  // ---------- Modale (confirm) ----------
  const onBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="styled-alert-title"
      aria-describedby="styled-alert-desc"
      className="styled-alert-backdrop"
      onClick={onBackdrop}
    >
      <div className={`styled-alert-card styled-alert-modal styled-alert--${type}`}>
        <div className="styled-alert-row">
          <div className={`styled-alert-icon styled-alert-icon--${type}`} aria-hidden="true">
            <span className="styled-alert-icon-char">❓</span>
          </div>
          <div className="styled-alert-body">
            <div id="styled-alert-title" className="styled-alert-title"> {title || 'Confirmation'} </div>
            {message ? <div id="styled-alert-desc" className="styled-alert-text styled-alert-text--modal">{message}</div> : null}
          </div>
        </div>

        <div className="styled-alert-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => { onConfirm?.(); onClose?.(); }}
          >
            {confirmLabel || 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}
