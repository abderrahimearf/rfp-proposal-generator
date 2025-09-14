import React from 'react';
import logo from './logo2.png';
import set from './5166607.png';
const navItems = ['Dashboard', 'Générer un RFP', 'Templates', 'base de connaissances'];

export default function Sidebar({ currentNav, onNavChange }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <img
          src={logo}
          alt="Propose Flow AI"
          className="brand-logo"
        />
        
      </div>
      <nav className="nav">
        {navItems.map(item => (
          <button
            key={item}
            className={`nav-item ${currentNav === item ? 'active' : ''}`}
            onClick={() => onNavChange(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button className="nav-item">
          <img 
      src={set} 
      alt="Settings" 
      style={{ width: "30px", height: "auto", verticalAlign: "middle", marginRight: "8px" }} />
          Settings
        </button>
      </div>
    </aside>
  );
}
