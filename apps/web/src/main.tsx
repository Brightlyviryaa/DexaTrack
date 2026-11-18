import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './app/App';
import { AppProviders } from './app/providers/AppProviders';
import './styles.css';

createRoot(document.getElementById('root')!).render(<AppProviders><BrowserRouter><App /></BrowserRouter></AppProviders>);
