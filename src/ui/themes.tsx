import { createRoot } from 'react-dom/client';
import { CLOSE_EDITOR_MESSAGE } from '../shared/editor-messages';
import { EditorApp } from './editor/EditorApp';
import './editor.css';

const params = new URLSearchParams(location.search);
const embedded = params.get('embedded') === '1';
const site = params.get('site') ?? undefined;
// When embedded in a Movix page, only the content script that created this frame acts on the message.
const close = () => window.parent.postMessage({ type: CLOSE_EDITOR_MESSAGE }, '*');

createRoot(document.getElementById('root')!).render(<EditorApp site={site} onClose={embedded ? close : undefined} />);
