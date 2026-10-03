export type Target = 'chrome' | 'firefox';

export interface ManifestInput {
  version: string;
  description: string;
  domains: readonly string[];
}

export const ICON_SIZES = [16, 32, 48, 128] as const;
// Firefox requires an email-shaped add-on ID; it identifies the extension and is never contacted.
const GECKO_ID = 'motix@mathr81';

/** Both browser manifests come from this one function, so they cannot drift apart. */
export function buildManifest(target: Target, { version, description, domains }: ManifestInput): Record<string, unknown> {
  // One pattern per root covers http, https, the root itself and its subdomains.
  const matches = domains.map((domain) => `*://*.${domain}/*`);
  const icons = Object.fromEntries(ICON_SIZES.map((size) => [size, `icons/icon-${size}.png`]));
  return {
    manifest_version: 3,
    name: 'Motix',
    version,
    description,
    author: 'Mathr81',
    icons,
    permissions: ['storage', 'activeTab'],
    action: { default_title: 'Motix', default_popup: 'popup.html', default_icon: icons },
    content_scripts: [{ matches, css: ['adapter.css'], js: ['content.js'], run_at: 'document_start' }],
    // The editor is embedded as an iframe on Movix's /themes path.
    web_accessible_resources: [{ resources: ['themes.html', 'assets/*', 'logos/*'], matches }],
    ...(target === 'firefox' && {
      browser_specific_settings: {
        gecko: { id: GECKO_ID, strict_min_version: '128.0', data_collection_permissions: { required: ['none'] } },
      },
    }),
  };
}
