# Writing custom CSS for a Motix theme

*Verified live against movix.college on 2026-10-04 (asset bundle `index-ak1k-thh.css` / `index-BnpioTHM.js`). Movix ships without warning and the public [MovixOpenSource](https://github.com/movixstream/MovixOpenSource) repository lags behind what is actually deployed — see [Architecture: The problem](ARCHITECTURE.md#the-problem). Treat every selector below as "true as of that date," not as a permanent contract. Before relying on one, re-check it against the live bundle with the recipe in [Verify against the live site, not the local checkout](#6-verify-against-the-live-site-not-the-local-checkout) — the same freshness check `pnpm sync:upstream` runs daily in CI for the adapter itself.*

This guide is the practical companion to [`ARCHITECTURE.md`](ARCHITECTURE.md): that document explains how Motix's colour adapter works, this one is for someone writing `customCss` in the editor's Advanced section and wants it to survive contact with the real site.

## The gate: what `validateCustomCss` accepts

Everything below either passes `src/theme/validation.ts` or it doesn't reach the page at all — the editor shows the same error inline. In order:

- **16 KB max.**
- **No `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>` tags**, and no `javascript:` URLs.
- **No backslashes, anywhere.** This blocks CSS escapes (`u\72 l` spelling `url`), which also means you cannot write `.md\:px-12` to target a Tailwind responsive/variant class. Target it as an attribute selector instead: `[class~="md:px-12"]`.
- **No remote or executable CSS features**: `@import`, `url()`, `image-set()`, `cross-fade()`, `image()`, `src()`, `expression()`, `-moz-binding`, `behavior:`. Nothing in a theme can fetch anything.
- **Braces must balance.**
- **No `eval(`/`new Function`.**
- **Only `@media` is allowed among at-rules**, one level deep (no `@font-face`, `@keyframes`, `@supports`, nesting). You get Movix's fonts and your own animations only through what's already on the page.
- **Selectors cannot target `html`, `body` or `:root`.** Start from `#root` (or deeper). This is also why every example below is prefixed `#root`.

If you're pasting a theme's `customCss` as JSON (an exported `.motix.json`, or `examples/notion/notion.motix.json`), remember that field is a **frozen copy** of the CSS string — editing the companion `.css` file does not update it. Regenerate it, don't hand-edit both:

```bash
node -e '
const fs = require("fs");
const css = fs.readFileSync("examples/<theme>/<theme>-theme.css", "utf8");
const json = JSON.parse(fs.readFileSync("examples/<theme>/<theme>.motix.json", "utf8"));
json.theme.customCss = css;
fs.writeFileSync("examples/<theme>/<theme>.motix.json", JSON.stringify(json, null, 2) + "\n");
'
```

## The variable system

Everything runs under `html[data-motix-theme]` (only present once a theme is active — without it the rules below match nothing). Two layers are available:

- **`--motix-*`**: the small, stable set you'll actually use — `--motix-background`, `-surface`, `-card`, `-card-hover`, `-primary`, `-primary-hover`, `-on-primary` (readable text for a solid primary fill), `-text`, `-muted`, `-border`, `-radius`, `-shadow`, `-glow`.
- **`--mx-{bg|fg|bd|sh}-{R}-{G}-{B}`**: the generated adapter (`src/theme/generated/adapter.css`), one variable per *original Movix colour* it found, named after what it does (background/foreground/border/shadow) and the literal RGB triplet it replaces. You won't write these directly, but it explains two things you'll run into:
  - Only **neutrals** (blacks/whites/grays) and **Movix's brand red** are remapped by `palette.ts`. Status colours (success green, warning yellow) and third-party brand colours (Netflix red, Prime blue) are **left alone on purpose** — don't treat an unthemed icon as a bug.
  - A colour only changes where Movix expressed it as a class the adapter saw in the live stylesheet. **Inline `style="…"` attributes and runtime `<style>` blocks are invisible to it** — see the first pitfall below.

## Known hooks (as of the date above)

Structural selectors used by the shipped Notion example (`examples/notion/notion-theme.css`) and the core adapter (`theme-css.ts`), as a starting catalogue — not exhaustive, and class names with no semantic meaning (`[class~="h-[64px]"]`) are Tailwind utilities, not Movix's own naming:

| Area | Selector | Notes |
| --- | --- | --- |
| Header scrim | `header > [class~="absolute"][class~="inset-0"]…[class~="bg-gradient-to-b"]` | Fixed, fades black→transparent at all scroll positions |
| Header height/logo | `header [class~="h-16"]`, `header a[class~="text-2xl"]` | |
| Page column | `.content-wrapper` | |
| Home slider | `.embla`, `.embla__slide` | Framer Carousel; `useFlexGapEmblaCarousel` under the hood |
| Section heading | `.section-title` | **Runtime `<style>`, not a stylesheet class — see pitfall below** |
| Poster card | `.media-color-card`, `.media-card-color-layers`, `.ranking-number` | Fixed 2:3 aspect ratio — see "don't change card heights" pitfall |
| Streaming tiles | `.platform-link` | |
| Canvas pointer grid | `canvas.absolute.inset-0.z-0.pointer-events-none`, `.square-bg-halo` | Painted on a `<canvas>`; colour only reachable via `filter: hue-rotate()` |
| Full-page backdrop | `.fixed.inset-0.pointer-events-none[style*="url("]` | Inline `background-image` |
| Footer gradient text | `.footer-vibe-text` | Shine effect — see pitfall below |
| Detail-page property grid | `[class~="grid"][class~="md:grid-cols-2"][class~="gap-4"][class~="mb-6"]` | |

## Pitfalls

### 1. Inline "shine" text has no class to hook into

Movix animates some headings (the search page's `<h1>`, hovered card titles) with a component (`ShinyText`) that sets its gradient directly as a JS-driven inline `style`, recomputed every animation frame — `backgroundImage`, `WebkitBackgroundClip`, `WebkitTextFillColor: transparent`. There is no stable class on the element, so a normal selector can never reach it, however specific.

Catch it by the inline style's own signature instead — an attribute-substring selector matches regardless of class:

```css
#root [style*="-webkit-text-fill-color"] {
  background: none !important;
  -webkit-text-fill-color: currentColor !important;
  color: #yourtextcolor !important;
}
```

This is the same trick the core adapter already uses for the full-page backdrop (`[style*="url("]` in `theme-css.ts`) — it's the standard answer whenever "the adapter/theme CSS can't reach it" turns out to mean "it's an inline style, not a stylesheet rule."

### 2. `opacity` dims the text as much as the fill — recolouring alone won't fix contrast

A "disabled but visually distinct" element (Movix's current-page pagination button, `bg-red-600 text-white disabled:opacity-30`) often gets its faded look from `opacity` on the whole element, not from an alpha channel on just the background. If you only override `color`, the new colour fades by the same 30% as everything else and can still read as washed out over a light page — **a computed-style check on `color` alone will report success while the element is still illegible.**

Fix the actual compositing: reset `opacity: 1` and move the fade onto the background's own alpha instead of the element's:

```css
#root button:disabled {
  opacity: 1 !important;
  background-color: rgb(var(--your-rgb) / 0.3) !important;
  color: var(--motix-text) !important;
}
```

Verify by reading `getComputedStyle(el).opacity` alongside `.color`, not just `.color` — or just look at it rendered, at the actual state (disabled/hover/active), not the default one.

### 3. Don't change card or row heights

Movix lazy-loads home-page rows into space reserved at a fixed height (`IntersectionObserver`-driven). A poster card styled taller or shorter than Movix's own 2:3 aspect ratio makes the page jump and re-stick while scrolling. If you need room for extra content (a caption, metadata), take it from inside the card — reflow the image area, don't grow the card.

### 4. Targeting Tailwind's own variant classes

`.md:grid-cols-2` is invalid CSS syntax outside Tailwind's own build (the colon needs an escape, and escapes are blocked by the gate). Always use the attribute form against the literal class list: `[class~="md:grid-cols-2"]`. This also reads more reliably than chained class selectors when Tailwind emits several arbitrary-value classes on one element (`[class~="h-[64px]"]`).

### 5. `!important` is close to mandatory

Movix's own Tailwind utilities compile flat with no particular specificity advantage, but the generated adapter (`adapter.css`) rewrites nearly all of them with `!important` already. Any override needs to match that, plus most of your selectors should be qualified with `#root` (adds an ID, not just a class) so you don't have to fight source order against the adapter's own rules.

### 6. Verify against the live site, not the local checkout

The local [MovixOpenSource](https://github.com/movixstream/MovixOpenSource) checkout is a useful map of structure and component names, but the deployed site is routinely ahead of it (new classes like `.media-color-card` shipped live before they existed in the public source). Before trusting a selector:

```bash
curl -s -A "Mozilla/5.0" https://movix.college/ -o /tmp/movix.html
# find the hashed asset names
grep -oE '"/assets/[A-Za-z0-9_-]*\.(js|css)"' /tmp/movix.html

curl -s -A "Mozilla/5.0" https://movix.college/assets/<hash>.css -o /tmp/movix.css
grep -o '\.your-candidate-class[^}]*}' /tmp/movix.css
```

For anything that doesn't show up in the compiled CSS at all (inline styles, runtime-injected `<style>` blocks, canvas-painted pixels), the JS bundle is the only source of truth — search it for the component or i18n key you're chasing, read the literal class string it builds, and check for `style.xxx =` / `styled-jsx`-style imperative styling rather than a stylesheet class (pitfall 1 above).

## Before you ship a custom theme

Check these, not just the page you were looking at when you wrote the rule:

- [ ] **States, not just defaults**: hover, disabled, active/current, focus. Both bugs this guide documents were invisible on a freshly loaded page and only showed up in a non-default state (an animation frame, a disabled button).
- [ ] **Both breakpoints**, if your theme restructures layout at a width (the Notion example turns the header into a sidebar at `≥1024px`) — check both, not just the one you're developing at.
- [ ] **A second page type**: home, search, and a detail page at minimum. `.section-title` and inline backdrops only appear on some of them.
- [ ] **Scroll a lazy-loaded row** to confirm nothing jumps (pitfall 3).
- [ ] **Re-run the live-bundle check** (pitfall 6) if it's been more than a few days since you last verified — Movix ships without a changelog.
