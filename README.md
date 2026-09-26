# Motix — Make Movix yours

Motix is a local-first visual theming WebExtension for Chrome and Firefox. It only styles validated Movix website domains; it does not alter playback, accounts, APIs, or site behavior.

## Repository analysis and integration decision

The upstream Movix source and the live `movix.college` site were inspected. The app uses React and Tailwind, but its actual styling hooks differ from older source assumptions: current media cards use `.media-color-card` with inline `--media-color` and `--media-color-surface` variables, section headings use `.section-title`, provider logos use `.platform-link`, and controls/surfaces commonly rely on utility classes. The adapter was checked against the live home, catalog, search, genre, provider, and detail routes. The player remains intentionally untouched.

The provided local workspace has no Movix source tree, package files, or Git repository, so Motix is implemented as a standalone extension; it does not change the upstream site. On supported domains, `/themes` keeps its URL and displays the editor in a dedicated extension iframe, while hiding the app root only for that route. A Movix checkout integration could later replace that with a React Router route without rewriting the theme engine.

## Domain policy

The built-in allowlist is based on exact Movix host roots published in the upstream browser extension manifest: `movix.cash`, `movix.cloud`, `movix.tax`, `movix.club`, `movix.golf`, `movix.chat`, `movix.date`, `movix.fun`, `movix.show`, `movix.men`, and `movix.college`. These names are configuration, not a claim that every host currently serves the site. Host checks allow exact roots and dot-boundary subdomains; `fake-movix.online` never matches. `movix.online` is a directory only, not a supported styling target.

Directory refresh is optional and user initiated. The response is size- and timeout-limited; discovered hosts are validated and intersected with the built-in trusted list. Failed discovery leaves the cached settings intact. New official domains should be reviewed and added to `src/shared/domains.ts` and both manifests before release. The extension does not prompt for broad host access or use `<all_urls>`.

## Architecture

- `src/shared`: strict types, hostname allowlist, schema migration, browser storage, validators, and CSS variable generation.
- `src/data/themes.ts`: twelve editable built-in presets.
- `src/content`: guarded content injection and lightweight history/popstate route detection.
- `src/ui`: accessible popup, editor, preview, and isolated stylesheet.
- `manifest.chrome.json` and `manifest.firefox.json`: minimal browser manifests.
- `public/content.js`: dependency-free browser content script, packaged from Vite's public directory.

Settings are local in `chrome.storage.local` / `browser.storage.local`, under `motixSettings`. The extension uses the WebExtensions storage change event to refresh open tabs. If the UI is run outside an extension context, localStorage is a development fallback.

## Security and privacy

Motix stores themes on this device and does not send theme content to a server. It does not collect browsing or account data. Only the style node and root data attribute it owns are added/removed. Imported JSON has a 128 KB limit and must pass a typed schema check. Custom CSS is optional, limited to 16 KB, rejects HTML/script tags, remote URLs/imports, executable CSS features, and JavaScript-looking constructs, and is scoped under the Motix document attribute. It is never evaluated as JavaScript. The extension uses `storage`, `activeTab`, and `scripting` plus explicit Movix host matches. The `scripting` permission is used only to insert/remove the generated CSS in the tab’s author cascade; no scripts are executed on the page.

## Development

Node.js 18+ recommended.

```sh
bun install
bun run dev
bun run typecheck
bun test
```

The development server previews the popup/editor UI; extension APIs require a browser-loaded build. No install scripts or remote code are used.

## Chrome build and manual installation

```sh
bun run build:chrome
```

Then open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `build/chrome/`. For Edge/Brave use their extensions page and the same folder. Reload the extension after rebuilding; refresh already-open supported site tabs.

## Firefox build and manual installation

```sh
bun run build:firefox
```

Open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on…**, and select `build/firefox/manifest.json`. Temporary add-ons are removed when Firefox closes. Store distribution signing/validation is a separate release task.

## Tests

`npm test` covers strict hostname/domain boundaries, domain-directory input validation, theme import/export validation, unsafe CSS rejection and scoped variable generation, and `/themes` route matching. It does not replace real-browser checks.

### Manual test checklist

- [ ] Load the Chrome build and Firefox build separately.
- [ ] Verify popup indicates unsupported on an unrelated host and does not inject a style element.
- [ ] Verify a Movix root and an approved subdomain are supported; try a lookalike fake hostname.
- [ ] Enable/disable Motix and confirm the owned `#motix-theme-styles` node is added/removed.
- [ ] Select presets, adjust colors and sliders, and check the preview at desktop/tablet/mobile widths.
- [ ] Save themes globally and per domain; switch domains and verify distinct active themes.
- [ ] Import valid JSON, reject malformed/oversized themes and unsafe CSS, then export and re-import.
- [ ] Navigate to `/themes` directly and through SPA navigation; use the return button and verify app display restores.
- [ ] Open multiple tabs and verify saved changes sync without a reload.
- [ ] Check movie cards, navigation, buttons, modal, text, and a playing video. Video controls and playback must be unaffected.
- [ ] Use keyboard only and enable `prefers-reduced-motion`.
- [ ] Check narrow mobile and desktop layouts.

## Known limitations

- The upstream website was inspected remotely because no Movix checkout was provided locally. Its CSS and markup vary across routes and may change; the adapter covers the routes inspected, but future or uninspected components may need another page-specific styling rule.
- `/themes` is an extension-owned iframe page, not a new route in Movix React Router. Direct route fallback requires the extension content script to be permitted on that domain.
- CSS and browser policy may differ on future Movix domains. A new domain needs review and manifest updates; directory discovery cannot add arbitrary domains by itself.
- `storage.local` is browser-profile local and does not sync between separate browser installations.
- Firefox and Chrome use Manifest V3. Chrome runs the worker as a service worker; Firefox uses its supported `background.scripts` event-page form. Browser APIs are shared through `browser`/`chrome` detection. Test the produced build in current stable browsers before publishing.
- No automated browser integration suite is included in this empty workspace; manual Chrome/Firefox testing is required.

## Future improvements

A reviewed signed domain-list update, Playwright browser tests, optional per-domain style adapters based on updated upstream markup, and a theme sharing format with signatures could be added while keeping the extension local-first.
"# Motix" 
