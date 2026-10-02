// Regenerates the theme adapter from the stylesheets Movix currently serves.
// Usage: pnpm sync:upstream [--origin https://movix.example] [--css local-file.css]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import directory from '../src/shared/domains.json' with { type: 'json' };
import { buildAdapter } from './lib/build-adapter';
import { fetchText } from './lib/http';

// A real Movix build ships over a thousand colour rules; far fewer means we fetched the wrong page.
const MIN_EXPECTED_TOKENS = 100;

const { values } = parseArgs({ options: { origin: { type: 'string' }, css: { type: 'string' } } });

async function liveStylesheets(origin: string): Promise<string> {
  const html = await fetchText(origin);
  const hrefs = [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)]
    .map((tag) => /href=["']([^"']+)["']/i.exec(tag[0])?.[1])
    .filter((href): href is string => Boolean(href))
    .map((href) => new URL(href, origin))
    .filter((url) => url.origin === new URL(origin).origin);
  if (!hrefs.length) throw new Error(`No stylesheet found on ${origin}.`);
  const sheets = await Promise.all(hrefs.map((url) => fetchText(url.toString())));
  console.log(`Fetched ${hrefs.length} stylesheet(s) from ${origin}.`);
  return sheets.join('\n');
}

const source = values.css ? await readFile(resolve(values.css), 'utf8') : await liveStylesheets(values.origin ?? `https://${directory.primary}`);
const adapter = buildAdapter(source);
if (adapter.tokens.length < MIN_EXPECTED_TOKENS) throw new Error(`Only ${adapter.tokens.length} colour tokens found; refusing to overwrite the adapter.`);

const outputDir = resolve(process.cwd(), 'src/theme/generated');
await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, 'adapter.css'), adapter.css);
await writeFile(resolve(outputDir, 'tokens.json'), `${JSON.stringify(adapter.tokens, null, 2)}\n`);
console.log(`Adapter written: ${adapter.css.split('\n').length - 2} rules, ${adapter.tokens.length} colour tokens.`);
