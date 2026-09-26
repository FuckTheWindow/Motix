// Roots cross-checked against Movix's public browser-extension manifest (upstream main, 2026-09).
// This allowlist is intentionally conservative; directory discoveries must be approved here too.
export const BUILT_IN_MOVIX_DOMAINS = [
  'movix.cash',
  'movix.cloud',
  'movix.tax',
  'movix.club',
  'movix.golf',
  'movix.chat',
  'movix.date',
  'movix.fun',
  'movix.show',
  'movix.men',
  'movix.college',
] as const;

const DOMAIN_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, '');
}

export function isValidHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return DOMAIN_RE.test(normalized) && !normalized.includes('..');
}

export function isSupportedMovixDomain(hostname: string, approvedDomains: readonly string[] = BUILT_IN_MOVIX_DOMAINS): boolean {
  const candidate = normalizeHostname(hostname);
  if (!isValidHostname(candidate)) return false;
  return approvedDomains.some((root) => {
    const normalizedRoot = normalizeHostname(root);
    if (!isValidHostname(normalizedRoot)) return false;
    return candidate === normalizedRoot || candidate.endsWith(`.${normalizedRoot}`);
  });
}

export function validatedDirectoryDomains(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 100) return [];
  const validated = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    let hostname = item.trim();
    try {
      hostname = hostname.includes('://') ? new URL(hostname).hostname : hostname;
    } catch {
      continue;
    }
    hostname = normalizeHostname(hostname);
    if (isValidHostname(hostname) && isSupportedMovixDomain(hostname)) validated.add(hostname);
  }
  return [...validated];
}
