import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import App2 from './App2';

import Dashboard from './dashboard';

import { AuthProvider } from './auth/AuthContext';
import PrivateRoute from './auth/PrivateRoute';
import UploadDocument from './UploadDocument';
import Setting from './setting';
import App from './App';  // Assurez-vous que le chemin est correct  
import Home from './Home'; // Assurez-vous que le chemin est correct 

const Ro = () => (
  <AuthProvider>
    <Routes>
      {/* Pages publiques */}
      <Route path="/" element={<Home />} />
      
     
      <Route path="/generation" element={<App />} />

      {/* Toutes les autres pages → protégées */}
      <Route
        path="/upload"
        element={
          <PrivateRoute roles={['admin', 'user']}>
            <UploadDocument />
          </PrivateRoute>
        }
      />

      <Route
        path="/UPLODE"
        element={<Navigate to="/upload" replace />}
      />

      <Route
        path="/data"
        element={
          <PrivateRoute roles={['admin', 'user']}>
            <App2 />
          </PrivateRoute>
        }
      />

      <Route
        path="/Dashboard"
        element={
          <PrivateRoute roles={['admin', 'user']}>
            <Dashboard />
          </PrivateRoute>
        }
      />

      <Route
        path="/Setting"
        element={
          <PrivateRoute roles={['admin', 'user']}>
            <Setting />
          </PrivateRoute>
        }
      />

      {/* Toute URL inconnue redirige vers Homme */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </AuthProvider>
);

export default Ro;
