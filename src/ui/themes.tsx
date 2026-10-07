import { createRoot } from 'react-dom/client';
import { CLOSE_EDITOR_MESSAGE } from '../shared/editor-messages';
import { EditorApp } from './editor/EditorApp';
import { applyDocumentLocale } from './i18n';
import './editor.css';

applyDocumentLocale();
const params = new URLSearchParams(location.search);
const embedded = params.get('embedded') === '1';
const site = params.get('site') ?? undefined;
// Docked beside a Movix page, only the content script that created this frame acts on the message.
const close = () => window.parent.postMessage({ type: CLOSE_EDITOR_MESSAGE }, '*');
if (embedded) document.body.classList.add('mx-embedded');

createRoot(document.getElementById('root')!).render(<EditorApp site={site} onClose={embedded ? close : undefined} />);
