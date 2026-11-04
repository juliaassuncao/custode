// Memory-only lifecycle guard, not a replacement for Auth's server-side verification.
// Tokens never go into application state, storage, logs or URLs.
type Reason = 'expired' | 'consumed' | 'invalidated';
type Entry = { expires: number; usable: boolean; notify?: (reason: Reason) => void };
const tokens = new Map<string, Entry>();
const lifetime = 300_000;

export function registerCaptchaToken(token: string, notify: (reason: Reason) => void): boolean {
  const now = Date.now();
  for (const [key, entry] of tokens) {
    if (entry.expires <= now) {
      tokens.delete(key);
      entry.notify?.('expired');
    }
  }
  if (!token || token.length > 2048 || tokens.has(token)) return false;
  tokens.set(token, { expires: now + lifetime, usable: true, notify });
  return true;
}

export function invalidateCaptchaToken(token: string) {
  const entry = tokens.get(token);
  if (!entry) return;
  entry.usable = false;
  const notify = entry.notify;
  entry.notify = undefined;
  notify?.('invalidated');
}

export function consumeCaptchaToken(token?: string): boolean {
  if (!token) return false;
  const entry = tokens.get(token);
  if (!entry || !entry.usable) return false;
  entry.usable = false; // Spend before network I/O, including failed attempts.
  const notify = entry.notify;
  entry.notify = undefined;
  if (entry.expires <= Date.now()) {
    notify?.('expired');
    return false;
  }
  notify?.('consumed');
  return true;
}
