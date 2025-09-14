import React from 'react';
import { GenerationCard } from './generation-card';
import { useNavigate } from 'react-router-dom';
const styles = {
  main: {
    flex: 1,
    padding: '32px',
   background: 'transparent',

    display: 'flex',
    flexDirection: 'column'
  },
  headerLogo: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '24px'
  },
  logoIcon: {
    width: '32px',
    height: '32px',
    background: '#f0f3f6ff',
    borderRadius: '4px',
    marginRight: '8px'
  },
  logoText: {
    fontWeight: 'bold',
    color: '#333'
  },
  heading: {
    textAlign: 'center',
    fontSize: '2rem',
    marginBottom: '24px',
    color: '#000',
    fontFamily: 'cursive',
  },
  introContainer: {
    maxWidth: '600px',
    margin: '0 auto 48px',
    padding: '24px',
    background: '#F5F5F5',
    borderRadius: '6px',
    
    marginBottom: '80px',
  },
  introText: {
    color: '#333',
    lineHeight: 1.5,
    fontFamily: 'cursive',
  },
  cardsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '24px',
    justifyItems: 'center'
  }
};

export function MainContent({ onGetStarted }) {
  return (
    <div style={styles.main}>
      <div style={styles.headerLogo}>
        
        
      </div>
      <h1 style={styles.heading}>
        La puissance de l’IA au service de vos réponses stratégiques
      </h1>
      <div style={styles.introContainer}>
        <p style={styles.introText}>
          Découvrez l’avenir de la rédaction de documents commerciaux.
Notre application intelligente automatise la création de vos demandes d’informations (RFI), demandes de prix (RFQ) et appels d’offres (RFP), en s’appuyant sur votre base de connaissances et les données du marché.
Gagnez en efficacité, assurez une cohérence irréprochable et optimisez chaque réponse pour maximiser vos chances de succès — dès aujourd’hui.
        </p>
      </div>
      <div style={styles.cardsContainer}>
        <GenerationCard
          title="Proposal Generation"
          onGetStarted={() => onGetStarted('Proposal')}
        />
        <GenerationCard
          title="RFI Generation"
          onGetStarted={() => onGetStarted('RFI')}
        />
        <GenerationCard
          title="RFQ Generation"
          onGetStarted={() => onGetStarted('RFQ')}
        />
      </div>
    </div>
  );
}
