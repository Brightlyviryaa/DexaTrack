import { Request, Response, NextFunction } from 'express';
// shortcut: per-process limiter, use a shared store before running multiple gateway replicas.
export function securityMiddleware(origin: string) {
  const attempts = new Map<string, { count: number; until: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.headers.origin !== origin || req.headers['x-dexatrack-request'] !== '1') return res.status(403).json({ message: 'Origin request tidak diizinkan.' });
      if (/\/auth\/(login|register|forgot-password|reset-password|activate)$/.test(req.path)) {
        const now = Date.now();
        for (const [key, bucket] of attempts) if (bucket.until <= now) attempts.delete(key);
        const key = `${req.ip}:${req.path}`;
        const bucket = attempts.get(key) ?? { count: 0, until: now + 15 * 60_000 };
        attempts.set(key, bucket);
        if (++bucket.count > (req.path.endsWith('/login') ? 20 : 10)) {
          res.setHeader('Retry-After', Math.ceil((bucket.until - now) / 1000));
          return res.status(429).json({ message: 'Terlalu banyak percobaan. Coba lagi nanti.' });
        }
      }
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  };
}
