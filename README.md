# Motix — Make Movix yours

*[Version française](README.fr.md)*

Motix is a browser extension for Chrome and Firefox that restyles [Movix](https://github.com/movixstream/MovixOpenSource) websites: pick one of sixteen themes or build your own, and the whole site follows. It only changes how the site looks. It never touches playback, accounts or network requests, and everything stays on your device.

## What it does

- **Whole-site themes.** Colours, corner roundness, shadows and glow apply across every page, including hover states, not just a handful of components.
- **Sixteen presets**, light and dark, plus a step-by-step editor with a live preview.
- **Per-site or global.** Use one theme everywhere or a different one on each Movix domain.
- **Import and export** themes as JSON files.
- **Optional custom CSS** for people who want it, restricted to plain local rules.
- **The video player is left alone** unless you opt in.

## Install from source

Requires Node.js 22+ and [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm build
```

This produces `build/chrome/` and `build/firefox/`.

- **Chrome, Edge, Brave:** open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `build/chrome/`.
- **Firefox:** open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on…**, and select `build/firefox/manifest.json`. Temporary add-ons are removed when Firefox closes.

After rebuilding, reload the extension and refresh any open Movix tab.

## Using it

Open a Movix site and click the Motix toolbar icon. The popup lets you switch Motix on or off for that site and pick a theme. **Customize theme** opens the full editor in a new tab; **Open Themes page** shows the same editor inside the site at `/themes`.

## Supported domains

Motix runs only on the domains listed in [`src/shared/domains.json`](src/shared/domains.json), which is generated from Movix's official directory at <https://movix.online/address.json>. Subdomains of those roots are included; lookalikes such as `fake-movix.example` are not. A scheduled job opens a pull request when the directory changes, and the new domain reaches users with the next release.

## Privacy and security

- Themes and settings are stored in the browser's local extension storage. Nothing is sent anywhere, and no browsing or account data is collected.
- Permissions are limited to `storage`, `activeTab` and the Movix domains above. There is no background script.
- Imported theme files are limited to 128 KB and checked against a strict schema.
- Custom CSS is limited to 16 KB, may not load remote resources (`url()`, `@import`), may not target `html`, `body` or `:root`, and is scoped to the themed page. It is never evaluated as JavaScript.

## Development

```sh
pnpm dev          # preview the popup and editor in a browser, without extension APIs
pnpm check        # everything CI runs: typecheck, lint, unit tests, build, browser tests
```

| Command | What it does |
| --- | --- |
| `pnpm typecheck` | TypeScript, strict. |
| `pnpm lint` | ESLint. |
| `pnpm test` | Unit tests (Node's test runner). |
| `pnpm build` | Builds both extensions into `build/`. |
| `pnpm test:e2e` | Browser tests against the built Chrome extension. Run `pnpm build` first; the first run also needs `pnpm exec playwright install chromium`. |
| `pnpm lint:firefox` | Validates the Firefox build with Mozilla's `web-ext`. |
| `pnpm sync:domains` | Refreshes the supported-domain list from Movix's directory. |
| `pnpm sync:upstream` | Regenerates the theme adapter from the stylesheet Movix currently serves. |
| `pnpm preview:live` | Screenshots the real site with a few themes into `test-results/live/`. |
| `pnpm generate:icons` | Regenerates the extension icons from `public/icons/icon.svg`. |
| `pnpm generate:logos` | Regenerates the preset wordmarks in `public/logos/`. |

### How it works

Movix has no theming system: its colours are hard-coded utility classes. Motix ships a stylesheet generated from Movix's own, in which every colour is replaced by a CSS variable that falls back to the original. A theme is then just a set of values for those variables. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the details and the known limits.

```
src/
  content/   content script: applies the theme, embeds the editor on /themes
  shared/    domains, storage and migration, browser API typing
  theme/     presets, colour mapping, CSS generation, validation, generated adapter
  ui/        popup and editor (React)
scripts/     build packaging and the two sync scripts
tests/
  unit/      pure logic
  e2e/       Playwright, against a fixture Movix page
```

## Testing

The unit tests cover domain matching (including every fake domain Movix warns about), settings migration, theme validation, colour mapping and adapter generation.

The browser tests load the built extension into Chromium and drive it against a small fixture page served under real Movix hostnames, with no network access. They cover unsupported and lookalike hosts, subdomains, switching Motix on and off, presets, the editor, per-domain themes, tab synchronisation, import and export, rejected files and CSS, the `/themes` page, the player opt-in, a narrow viewport and reduced motion.

What still needs a person:

- [ ] Load the Firefox build and repeat a quick pass there (Playwright cannot drive extensions in Firefox).
- [ ] Run `pnpm preview:live` and look at the screenshots: the fixture cannot tell whether a theme looks right on the real site.
- [ ] Play a video with a theme active and confirm the controls and playback are unaffected.

## Known limitations

- Colours Movix sets through inline `style` attributes or through CSS it injects at runtime are mostly out of reach.
- Movix uses the same red for its brand and for error messages, so both follow the theme accent.
- The `/themes` page is provided by the extension, not by Movix: it only exists where Motix is installed.
- Settings do not sync between browsers or devices.

## License

[MIT](LICENSE). Motix is an independent project and is not affiliated with Movix.
