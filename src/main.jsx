import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/raleway'; // self-hosted, no external font request
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
