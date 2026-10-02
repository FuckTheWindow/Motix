import { useCallback, useEffect, useState } from 'react';
import { activeTabHostname } from '../../shared/browser';
import { isSupportedMovixDomain } from '../../shared/domains';
import { getSettings, onSettingsChanged, resolveActiveTheme, resolveEnabled } from '../../shared/storage';
import type { MotixSettings } from '../../shared/types';

/**
 * Settings plus the Movix site this UI is acting on. `site` pins the hostname (the editor is
 * opened for a given tab); without it the popup falls back to the active tab.
 */
export function useMotixData(site?: string) {
  const [settings, setSettings] = useState<MotixSettings | null>(null);
  const [hostname, setHostname] = useState(site ?? '');

  const reload = useCallback(async () => setSettings(await getSettings()), []);

  useEffect(() => {
    let live = true;
    void (async () => {
      const [nextSettings, nextHostname] = await Promise.all([getSettings(), site ?? activeTabHostname()]);
      if (!live) return;
      setSettings(nextSettings);
      setHostname(nextHostname);
    })();
    const unsubscribe = onSettingsChanged((next) => { if (live) setSettings(next); });
    return () => { live = false; unsubscribe(); };
  }, [site]);

  const supported = Boolean(hostname) && isSupportedMovixDomain(hostname);
  const scope = supported ? hostname : undefined;
  return {
    settings,
    hostname,
    supported,
    /** The hostname to scope changes to, or undefined when they should apply globally. */
    scope,
    activeTheme: settings ? resolveActiveTheme(settings, scope) : undefined,
    enabled: settings ? resolveEnabled(settings, scope) : true,
    reload,
  };
}
