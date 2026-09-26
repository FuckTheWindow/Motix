import React from 'react';
import { createRoot } from 'react-dom/client';
import { MotixApp } from './MotixApp';
import './editor.css';

const params = new URLSearchParams(location.search);
const embedded = params.get('embedded') === '1';
const site = params.get('site') ?? undefined;
const close = () => window.parent.postMessage({ type: 'MOTIX_CLOSE_EDITOR' }, '*');

createRoot(document.getElementById('root')!).render(<MotixApp mode={embedded ? 'embedded' : 'editor'} site={site} onClose={close} />);
