import React from 'react';

export default function SectionList({ sections, onToggle }) {
  return (
    <div className="section-list">
      {sections.map(sec => (
        <label key={sec.id} className="section-item">
          <input
            type="checkbox"
            checked={sec.checked}
            onChange={() => onToggle(sec.id)}
          />
          <span>{sec.label}</span>
        </label>
      ))}
    </div>
  );
}
