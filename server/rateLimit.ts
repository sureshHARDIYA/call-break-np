import type { NextFunction, Request, Response } from 'express';

interface WindowCounter {
  count: number;
  resetAt: number;
}

/**
 * Minimal fixed-window, per-IP rate limiter for low-volume endpoints.
 * State is in-process, which matches the single-instance deployment.
 */
export function createRateLimiter(options: { windowMs: number; max: number }) {
  const counters = new Map<string, WindowCounter>();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, counter] of counters) {
      if (counter.resetAt <= now) counters.delete(key);
    }
  }, options.windowMs);
  sweep.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const current = counters.get(key);
    const counter =
      current && current.resetAt > now
        ? { count: current.count + 1, resetAt: current.resetAt }
        : { count: 1, resetAt: now + options.windowMs };
    counters.set(key, counter);

    if (counter.count > options.max) {
      res.setHeader('Retry-After', Math.ceil((counter.resetAt - now) / 1000));
      res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
      return;
    }
    next();
  };
}
