import type { MouseEvent, SyntheticEvent } from 'react';

const MARGIN = 12;
// Set by a click on the summary, so sections opened by default (or by code) never move the view.
const REQUESTED = 'mxRevealRequested';

/** Put on a `<summary>`: the user asked to open or close this section. Keyboard activation also fires click. */
export function requestReveal(event: MouseEvent<HTMLElement>): void {
  const details = event.currentTarget.parentElement;
  if (details instanceof HTMLDetailsElement) details.dataset[REQUESTED] = 'true';
}

/**
 * Put on a `<details>` as `onToggle`: once the user opens it, scroll just enough to show what it holds. A section
 * that fits is shown whole; a taller one is aligned to its title. The editor's own scroll area is moved directly,
 * because scrollIntoView from the docked frame could also scroll the Movix page behind it.
 */
export function revealOnOpen(event: SyntheticEvent<HTMLDetailsElement>): void {
  const details = event.currentTarget;
  const requested = details.dataset[REQUESTED] === 'true';
  delete details.dataset[REQUESTED];
  if (!requested || !details.open) return;

  const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  // Wait a frame so the opened content has its height.
  requestAnimationFrame(() => {
    const scroller = details.closest<HTMLElement>('.mx-editor-main');
    if (!scroller || scroller.scrollHeight <= scroller.clientHeight) {
      // The page itself scrolls (editor opened on its own on a narrow screen).
      details.scrollIntoView({ block: 'nearest', behavior });
      return;
    }
    const box = details.getBoundingClientRect();
    const view = scroller.getBoundingClientRect();
    let delta = 0;
    if (box.height + MARGIN * 2 > view.height || box.top < view.top) delta = box.top - view.top - MARGIN;
    else if (box.bottom > view.bottom - MARGIN) delta = box.bottom - view.bottom + MARGIN;
    if (delta) scroller.scrollBy({ top: delta, behavior });
  });
}
