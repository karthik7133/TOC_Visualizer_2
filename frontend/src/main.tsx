import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
import App from './App';
import './styles/glassmorphism.css';

// Set backend API base URL (Render deployment or custom env var)
axios.defaults.baseURL = (import.meta as any).env?.VITE_API_BASE_URL || 'https://automata-visualizer-groq.onrender.com';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
