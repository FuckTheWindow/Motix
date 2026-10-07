import { useId } from 'react';
import { t } from '../i18n';

/** Motix's mark, drawn from public/icons/icon.svg so the popup and editor match the toolbar icon. */
function MotixIcon() {
  // React ids contain colons, which some engines reject inside url(#…).
  const gradient = `mx-icon-${useId().replace(/:/g, '')}`;
  return (
    <svg className="mx-wordmark-icon" viewBox="0 0 128 128" width="30" height="30" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradient} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#b1f175" />
          <stop offset="1" stopColor="#60c849" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="116" height="116" rx="30" fill={`url(#${gradient})`} />
      <path fill="#0b1608" d="M64 22c4 27 15 38 42 42-27 4-38 15-42 42-4-27-15-38-42-42 27-4 38-15 42-42z" />
    </svg>
  );
}

export function Wordmark({ withTagline = false }: { withTagline?: boolean }) {
  return (
    <span className="mx-wordmark">
      <MotixIcon />
      <span className="mx-wordmark-words">
        <span className="mx-wordmark-text">motix</span>
        {withTagline && <span className="mx-wordmark-tagline">{t('tagline')}</span>}
      </span>
    </span>
  );
}
