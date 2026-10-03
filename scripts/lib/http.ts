const TIMEOUT_MS = 20_000;
const ATTEMPTS = 3;
const USER_AGENT = 'Mozilla/5.0 (compatible; motix-sync)';

export async function fetchText(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Could not fetch ${url}`, { cause: lastError });
}
