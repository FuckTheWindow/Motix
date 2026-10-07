import { createRoot } from 'react-dom/client';
import { applyDocumentLocale } from './i18n';
import { PopupApp } from './popup/PopupApp';
import './editor.css';

applyDocumentLocale();
// `?site=` pins the popup to a hostname instead of the active tab (used by the browser tests).
const site = new URLSearchParams(location.search).get('site') ?? undefined;

createRoot(document.getElementById('root')!).render(<PopupApp site={site} />);
