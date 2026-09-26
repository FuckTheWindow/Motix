const extension = globalThis.browser ?? globalThis.chrome;

function isAllowedHost(hostname) {
  const roots = ['movix.cash', 'movix.cloud', 'movix.tax', 'movix.club', 'movix.golf', 'movix.chat', 'movix.date', 'movix.fun', 'movix.show', 'movix.men', 'movix.college'];
  const normalized = String(hostname || '').toLowerCase().replace(/\.$/, '');
  return roots.some((root) => normalized === root || normalized.endsWith(`.${root}`));
}

extension.runtime.onMessage.addListener((message, sender) => {
  if (!message || !sender.tab?.id) return undefined;
  let senderHost = '';
  try { senderHost = new URL(sender.url || '').hostname; } catch { return undefined; }
  if (!isAllowedHost(senderHost) || !isAllowedHost(message.hostname) || senderHost.toLowerCase() !== String(message.hostname).toLowerCase()) return undefined;
  if (message.type !== 'MOTIX_SET_PAGE_CSS' && message.type !== 'MOTIX_REMOVE_PAGE_CSS') return undefined;
  if (typeof message.css !== 'string' || message.css.length > 64_000) return undefined;
  const target = { tabId: sender.tab.id };
  const scripting = extension.scripting;
  if (!scripting?.insertCSS || !scripting?.removeCSS) return { ok: false, error: 'The browser does not support Motix page styling.' };
  const removePrevious = message.previousCss && typeof message.previousCss === 'string' && message.previousCss.length <= 64_000
    ? scripting.removeCSS({ target, css: message.previousCss, origin: 'USER' }).catch(() => undefined)
    : Promise.resolve();
  return removePrevious.then(() => {
    if (message.type === 'MOTIX_REMOVE_PAGE_CSS') {
      return scripting.removeCSS({ target, css: message.css, origin: 'USER' }).then(() => ({ ok: true }));
    }
    return scripting.insertCSS({ target, css: message.css, origin: 'USER' }).then(() => ({ ok: true }));
  }).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : 'Could not apply Motix styles.' }));
});
