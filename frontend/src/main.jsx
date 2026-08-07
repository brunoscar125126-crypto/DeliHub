import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Só existe de verdade no build de produção (`vite build` + `vite preview`,
// ou o deploy real na Vercel) — em `vite dev` o plugin não registra SW por
// padrão, então isso é um no-op inofensivo durante o desenvolvimento normal.
registerSW({ immediate: true });
