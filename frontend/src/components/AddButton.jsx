import React from 'react';

export default function AddButton({ label, onClick }) {
  return (
    <button className="add-button" onClick={onClick}>
      <span className="plus-icon">⊕</span> {label}
    </button>
  );
}
