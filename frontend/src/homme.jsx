import React from 'react';
import { Sidebarh } from './components/sidebarh';
import { MainContent } from './components/main-content';
import { useNavigate } from 'react-router-dom';

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
   background: 'white',

  }
};

export default function Homm() {
  const handleGetStarted = (type) =>
    console.log(`Starting ${type} generation...`);

  return (
    <div style={styles.container}>
      
      <MainContent onGetStarted={handleGetStarted} />
    </div>
  );
}
