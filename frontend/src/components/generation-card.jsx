import React from 'react';
import { FaChevronRight } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
const styles = {
  card: {
    width: '300px',
    padding: '24px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #dad5daff 0%, #e0e0e0 100%)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    boxShadow: '4px 4px 8px rgba(0, 0, 0, 0.2)',
  },
  title: {
    margin: 0,
    marginBottom: '24px',
    fontSize: '1.25rem',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center'
  },
  dot: {
    margin: '0 8px',
    fontSize: '1.25rem',
    color: '#2f34c9ff',
    lineHeight: 1
  },
  buttonGroup: {
    display: 'flex',
    alignItems: 'center'
    
  },
  textBtn: {
    background: '#000',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '1rem'
  },
  iconBtn: {
    background: '#000',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    marginLeft: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  }
};

export function GenerationCard({ title, onGetStarted }) {
  const navigate = useNavigate();
  const [first, second] = title.split(' ');
  return (
    <div style={styles.card}>
      <h3 style={styles.title}>
        {first}
        <span style={styles.dot}> </span>
        {second}
      </h3>
      <div style={styles.buttonGroup}>
        <button style={styles.textBtn} onClick={() => navigate('/auth')}>
          Get Started 
          
        </button>
        <button style={styles.iconBtn} onClick={onGetStarted}>
          <FaChevronRight />
        </button>
      </div>
    </div>
  );
}
