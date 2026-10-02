import { createRoot } from 'react-dom/client';
import { PopupApp } from './popup/PopupApp';
import './editor.css';

// `?site=` pins the popup to a hostname instead of the active tab (used by the browser tests).
const site = new URLSearchParams(location.search).get('site') ?? undefined;

createRoot(document.getElementById('root')!).render(<PopupApp site={site} />);
