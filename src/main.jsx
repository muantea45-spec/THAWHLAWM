import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { FontSizeProvider } from './context/FontSizeContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <FontSizeProvider>
      <App />
    </FontSizeProvider>
  </React.StrictMode>
);
