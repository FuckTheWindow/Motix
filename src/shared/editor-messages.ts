/** Posted by the embedded editor to the Movix page hosting it, asking to be closed. */
export const CLOSE_EDITOR_MESSAGE = 'MOTIX_CLOSE_EDITOR';

/**
 * Posted by the embedded editor whenever its draft changes, so the page behind it shows the draft before it is
 * saved. `theme` is null when the draft is Movix's untouched original look.
 */
export const PREVIEW_THEME_MESSAGE = 'MOTIX_PREVIEW_THEME';

/** Sent by the popup to the content script of the active Movix tab, asking it to open the editor. */
export const OPEN_EDITOR_MESSAGE = 'MOTIX_OPEN_EDITOR';
