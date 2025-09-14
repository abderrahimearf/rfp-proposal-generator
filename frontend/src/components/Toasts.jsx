import React from 'react';

export default function Toasts({ toasts, onClose }) {
  return (
    <div className="toasts">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast ${t.type === 'error' ? 'toast-error' : 'toast-success'}`}
        >
          <span>{t.msg}</span>
          <button onClick={() => onClose(t.id)} className="toast-close">×</button>
        </div>
      ))}
    </div>
  );
}
