import React from 'react';
import { FaHome, FaUser, FaPowerOff } from 'react-icons/fa';

const styles = {
  sidebar: {
    width: '150px',
    padding: '24px 16px',
   background: 'transparent',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '90vh',
   
    borderRaius: '8px', 
     boxShadow: '4px 4px 8px rgba(0, 0, 0, 0.2)',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '24px'
  },
  logoIcon: {
    width: '32px',
    height: '32px',
    background: '#0095FF',
    borderRadius: '4px',
    marginRight: '8px'
  },
  logoText: {
    margin: 0,
    lineHeight: 1.2,
    fontWeight: 'bold',
    color: '#060606',
  fontFamily: 'cursive',


  },
  navButton: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '8px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    color: '#363333ff',
    marginBottom: '8px'
  },
  logoutButton: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '8px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    color: '#332f2fff'
  },
  icon: {
    marginRight: '8px'
  }
};

export function Sidebarh() {
  return (
    <div style={styles.sidebar}>
      <div>
        <div style={styles.logoContainer}>
          <div style={styles.logoIcon}></div>
          <div>
            <p style={styles.logoText}>Datadictos</p>
            <p style={styles.logoText}>Flow AI</p>
          </div>
        </div>
        <button style={styles.navButton}>
          <FaHome style={styles.icon} /> Home
        </button>
        <button style={styles.navButton}>
          <FaUser style={styles.icon} /> Hamza.alaoui@gm
        </button>
      </div>
      <button style={styles.logoutButton}>
        <FaPowerOff style={styles.icon} /> Log out
      </button>
    </div>
  );
}
