import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register PWA Service Worker for offline shell & instant launch
if ('serviceWorker' in navigator && !window.location.protocol.startsWith('file')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      console.log('[Remotivity] Service Worker registered:', reg.scope);
    }).catch((err) => {
      console.warn('[Remotivity] Service Worker registration failed:', err);
    });
  });
}
