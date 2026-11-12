import type { IncomingMessage } from 'node:http';

/**
 * Browsers always send Origin on WebSocket handshakes. Reject handshakes that
 * come from a page on another site; clients without an Origin (scripts, tests)
 * are not browsers and gain nothing from this check either way.
 */
export function isSameOriginHandshake(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return true;
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Client address as reported by the reverse proxy, falling back to the socket. */
export function clientAddress(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[forwarded.length - 1] : forwarded;
  const lastHop = value?.split(',').pop()?.trim();
  return lastHop || req.socket.remoteAddress || 'unknown';
}

/** Tracks open connections per client address so one client cannot exhaust the server. */
export function createConnectionLimiter(maxPerAddress: number) {
  const openByAddress = new Map<string, number>();
  return {
    tryAcquire(address: string): boolean {
      const open = openByAddress.get(address) ?? 0;
      if (open >= maxPerAddress) return false;
      openByAddress.set(address, open + 1);
      return true;
    },
    release(address: string): void {
      const open = openByAddress.get(address) ?? 0;
      if (open <= 1) openByAddress.delete(address);
      else openByAddress.set(address, open - 1);
    },
  };
}

/** Returns a function that reports whether one more message fits in the current one-second window. */
export function createMessageBudget(maxPerSecond: number): () => boolean {
  let windowStart = Date.now();
  let count = 0;
  return () => {
    const now = Date.now();
    if (now - windowStart >= 1000) {
      windowStart = now;
      count = 0;
    }
    count += 1;
    return count <= maxPerSecond;
  };
}
