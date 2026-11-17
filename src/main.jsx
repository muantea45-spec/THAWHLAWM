import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Automatically reload when a new deployment renders an old chunk hash obsolete
window.addEventListener('vite:preloadError', (event) => {
  console.warn('New deployment detected (stale chunk hash). Reloading page...', event);
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
