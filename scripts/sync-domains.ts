// Refreshes the supported-domain list from Movix's official directory.
// Usage: pnpm sync:domains
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isValidHostname, normalizeHostname } from '../src/shared/hostname';
import { fetchText } from './lib/http';

const DIRECTORY_URL = 'https://movix.online/address.json';
const MAX_DOMAINS = 50;

interface DirectoryEntry { url?: unknown; domain?: unknown }

function hostnames(entries: unknown, field: 'url' | 'domain'): string[] {
  if (!Array.isArray(entries)) throw new Error(`address.json: expected an array of ${field} entries.`);
  const found = new Set<string>();
  for (const entry of entries as DirectoryEntry[]) {
    const raw = entry?.[field];
    if (typeof raw !== 'string') continue;
    const hostname = normalizeHostname(field === 'url' ? new URL(raw).hostname : raw);
    if (isValidHostname(hostname)) found.add(hostname);
  }
  return [...found];
}

const directory = JSON.parse(await fetchText(DIRECTORY_URL)) as { primary?: { url?: unknown }; active?: unknown; fake_domains?: unknown };
const domains = hostnames(directory.active, 'url');
if (!domains.length || domains.length > MAX_DOMAINS) throw new Error(`address.json: unexpected number of active domains (${domains.length}).`);
const primary = hostnames([directory.primary], 'url')[0];
if (!primary || !domains.includes(primary)) throw new Error('address.json: the primary domain is missing from the active list.');
const fakeDomains = hostnames(directory.fake_domains ?? [], 'domain').sort();

const root = process.cwd();
await writeFile(resolve(root, 'src/shared/domains.json'), `${JSON.stringify({ source: DIRECTORY_URL, primary, domains }, null, 2)}\n`);
await mkdir(resolve(root, 'tests/fixtures'), { recursive: true });
await writeFile(resolve(root, 'tests/fixtures/fake-domains.json'), `${JSON.stringify(fakeDomains, null, 2)}\n`);
console.log(`Synced ${domains.length} supported domains (primary: ${primary}) and ${fakeDomains.length} known fakes.`);
