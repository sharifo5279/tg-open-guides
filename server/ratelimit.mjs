// Fixed one-minute windows, held in memory. The service runs one instance, so
// a shared store would add a dependency without changing the result.
//
// Two ceilings apply to the read surfaces. The per-address one stops a single
// runaway client. The global one holds even if a client varies its forwarded
// address, which the per-address key cannot prevent behind an unknown number
// of proxies.

const WINDOW_MS = 60_000;
const PER_ADDRESS = Number(process.env.RATE_LIMIT_PER_ADDRESS) || 120;
const GLOBAL = Number(process.env.RATE_LIMIT_GLOBAL) || 1200;

const READ_PREFIXES = ['/h/', '/g/', '/mcp', '/for-agents', '/backlog'];

function isReadSurface(path) {
  return path === '/' || READ_PREFIXES.some((p) => path === p.replace(/\/$/, '') || path.startsWith(p));
}

export function rateLimit() {
  let windowStart = Date.now();
  let globalCount = 0;
  let counts = new Map();

  return (req, res, next) => {
    if (!isReadSurface(req.path)) return next();

    const now = Date.now();
    if (now - windowStart >= WINDOW_MS) {
      windowStart = now;
      globalCount = 0;
      counts = new Map();
    }

    const key = req.ip || 'unknown';
    const used = (counts.get(key) || 0) + 1;
    counts.set(key, used);
    globalCount += 1;

    const resetSeconds = Math.max(1, Math.ceil((windowStart + WINDOW_MS - now) / 1000));
    res.setHeader('RateLimit-Limit', String(PER_ADDRESS));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, PER_ADDRESS - used)));
    res.setHeader('RateLimit-Reset', String(resetSeconds));

    if (used > PER_ADDRESS || globalCount > GLOBAL) {
      res.setHeader('Retry-After', String(resetSeconds));
      const message = `Request limit reached. Retry in ${resetSeconds} seconds.`;
      if (req.path.startsWith('/mcp') || req.accepts(['html', 'json']) === 'json' || req.path.endsWith('json')) {
        return res.status(429).json({ error: 'rate_limited', message, retry_after: resetSeconds });
      }
      return res.status(429).type('text/plain').send(message);
    }
    next();
  };
}
