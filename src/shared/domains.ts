import directory from './domains.json';
import { isValidHostname, normalizeHostname } from './hostname';

export { isValidHostname, normalizeHostname };

// Single source of truth, refreshed from https://movix.online/address.json by `pnpm sync:domains`.
// The manifests are generated from the same file, so the two can never disagree.
export const MOVIX_DOMAINS: readonly string[] = directory.domains;

export function isSupportedMovixDomain(hostname: string, roots: readonly string[] = MOVIX_DOMAINS): boolean {
  const candidate = normalizeHostname(hostname);
  if (!isValidHostname(candidate)) return false;
  return roots.some((root) => candidate === root || candidate.endsWith(`.${root}`));
}
