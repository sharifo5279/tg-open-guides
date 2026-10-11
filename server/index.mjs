import express from 'express';
import { migrate, dbReady } from './db.mjs';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

const PORT = process.env.PORT || 10000;

app.get('/healthz', async (_req, res) => {
  res.status(200).json({ ok: true, db: await dbReady() });
});

app.get('/', (_req, res) => {
  res.type('html').send('<!doctype html><title>Trading Grid Open Guides</title><p>Starting up.</p>');
});

// Run migrations at boot. The prototype has one environment and no migration
// history to reconcile, so this is the cheapest safe thing.
try {
  await migrate();
  console.log('[boot] schema ready');
} catch (err) {
  console.error('[boot] migration failed:', err.message);
}

app.listen(PORT, () => console.log(`[boot] listening on ${PORT}`));
