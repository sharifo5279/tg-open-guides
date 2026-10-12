import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { migrate, dbReady } from './db.mjs';
import {
  listGuides,
  listHubs,
  getHub,
  getGuide,
  getVersion,
  listVersions,
  dbAvailable
} from './store.mjs';
import { specToMarkdown } from './spec.mjs';
import { renderGuidePage } from './render/guide.mjs';
import { renderCodeView } from './render/codeview.mjs';
import { renderHome, renderHub, hubToMarkdown, renderForAgents, renderBacklog, renderNotFound } from './render/pages.mjs';
import { handleMcpRequest } from './mcp.mjs';
import { mountBuilder } from './builder.mjs';
import { initHighlight } from './highlight.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

const PORT = process.env.PORT || 10000;

function baseUrlOf(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

app.use(express.json({ limit: '4mb' }));
// A request carrying ?v= is fingerprinted, so it can be cached hard. One without
// it must revalidate, or a stale copy outlives the deploy that replaced it.
app.use('/static', (req, res, next) => {
  res.setHeader(
    'Cache-Control',
    req.query.v ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate'
  );
  next();
}, express.static(path.join(here, '..', 'public'), { etag: true, lastModified: true, cacheControl: false }));

app.get('/healthz', async (_req, res) => {
  res.json({ ok: true, db: await dbReady() });
});

/* ---------------------------------------------------------------- catalogue */

app.get('/', async (req, res, next) => {
  try {
    const [hubs, guides] = await Promise.all([listHubs(), listGuides({ includeUnlisted: false })]);
    res.type('html').send(renderHome({ hubs, guides, baseUrl: baseUrlOf(req), dbUp: await dbAvailable() }));
  } catch (err) {
    next(err);
  }
});

/**
 * The hub front door. One hub is one community, and this is where a partner
 * arrives from an onboarding email.
 */
app.get('/h/:hub', async (req, res, next) => {
  try {
    const raw = req.params.hub;
    let format = 'html';
    let slug = raw;
    if (raw.endsWith('.md')) {
      format = 'md';
      slug = raw.slice(0, -3);
    } else if (raw.endsWith('.json')) {
      format = 'json';
      slug = raw.slice(0, -5);
    } else if (wantsMarkdown(req)) {
      format = 'md';
    } else if (wantsJson(req)) {
      format = 'json';
    }

    const hub = await getHub(slug);
    if (!hub) {
      if (format === 'html') return res.status(404).type('html').send(renderNotFound());
      return res.status(404).json({ error: 'not_found' });
    }
    const all = await listGuides({ includeUnlisted: false });
    const guides = all.filter((g) => g.hub_slug === slug);
    const base = baseUrlOf(req);

    if (format === 'md') {
      res.set('Access-Control-Allow-Origin', '*');
      return res.type('text/markdown; charset=utf-8').send(hubToMarkdown({ hub, guides, baseUrl: base }));
    }
    if (format === 'json') {
      res.set('Access-Control-Allow-Origin', '*');
      return res.json({
        hub: {
          slug: hub.slug, name: hub.name, legalName: hub.legalName, industry: hub.industry,
          about: hub.about, standard: 'X12', version: hub.stdVersion,
          effectiveFrom: hub.effectiveFrom, delimiters: hub.delimiters, envelope: hub.envelope,
          acknowledgment: hub.ackWindow, interfaceWindow: hub.maintenanceWindow,
          commonRules: hub.commonRules, contacts: hub.contacts
        },
        documents: guides.map((g) => ({
          transactionSet: g.transaction_set,
          title: g.title,
          direction: g.direction,
          version: g.cur_version,
          attestedBy: g.attested_by || null,
          guide: `${base}/g/${g.hub_slug}/${g.slug}.json`
        })),
        notice: 'Requirements as attested by the hub. This document does not validate or certify a transaction.'
      });
    }

    res.type('html').send(renderHub({ hub, guides, baseUrl: base }));
  } catch (err) {
    next(err);
  }
});

app.get('/backlog', (req, res) => {
  res.type('html').send(renderBacklog({ baseUrl: baseUrlOf(req) }));
});

app.get('/for-agents', async (req, res, next) => {
  try {
    const guides = await listGuides({ includeUnlisted: false });
    res.type('html').send(renderForAgents({ guides, baseUrl: baseUrlOf(req) }));
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------------- guides */

function wantsMarkdown(req) {
  const accept = String(req.get('accept') || '');
  if (/text\/markdown|text\/plain/i.test(accept) && !/text\/html/i.test(accept)) return true;
  return false;
}

function wantsJson(req) {
  const accept = String(req.get('accept') || '');
  if (/application\/json/i.test(accept) && !/text\/html/i.test(accept)) return true;
  return false;
}

async function loadGuide(hubSlug, guideSlug, versionNumber = null) {
  const guide = await getGuide(hubSlug, guideSlug);
  if (!guide) return null;
  const version = await getVersion(guide.id, versionNumber);
  if (!version) return { guide, version: null };
  return { guide, version };
}

/* The JSON payload, shared by the raw endpoint and the JSON view so the two
   can never drift. */
function guideJson(guide, version, base, guidePath) {
  return {
    ...version.spec,
    publication: {
      guideRef: `${guide.hub_slug}/${guide.slug}`,
      version: version.version,
      status: version.status,
      attestedBy: version.attested_by,
      attestedRole: version.attested_role,
      attestedAt: version.attested_at,
      publishedAt: version.published_at,
      compiledFrom: version.source_name,
      canonical: base + guidePath,
      markdown: `${base}${guidePath}.md`,
      notice:
        'Requirements as attested by the hub. This document does not validate or certify a transaction.'
    }
  };
}

async function serveGuide(req, res, { hubSlug, guideSlug, format, versionNumber = null }) {
  const found = await loadGuide(hubSlug, guideSlug, versionNumber);
  if (!found) {
    res.status(404);
    if (format === 'json') return res.json({ error: 'not_found' });
    if (format === 'md') return res.type('text/markdown').send('# Not found\n\nNo guide at this address.\n');
    return res.type('html').send(renderNotFound());
  }
  const { guide, version } = found;
  if (!version) {
    res.status(404);
    if (format === 'json') return res.json({ error: 'no_published_version' });
    return res.type('html').send(renderNotFound());
  }

  const base = baseUrlOf(req);
  const guidePath = `/g/${guide.hub_slug}/${guide.slug}`;
  const ua = req.get('user-agent') || '';

  if (format === 'json') {
    res.set('Access-Control-Allow-Origin', '*');
    return res.json(guideJson(guide, version, base, guidePath));
  }

  if (format === 'md') {
    res.set('Access-Control-Allow-Origin', '*');
    return res
      .type('text/markdown; charset=utf-8')
      .send(
        specToMarkdown(version.spec, {
          baseUrl: base,
          guidePath,
          version: version.version,
          attestation: version
        })
      );
  }

  const versions = await listVersions(guide.id);
  res.type('html').send(
    renderGuidePage({
      spec: version.spec,
      guide,
      version,
      versions,
      baseUrl: base,
      guidePath,
    })
  );
}

app.get('/g/:hub/:guide', async (req, res, next) => {
  try {
    const raw = req.params.guide;
    let format = 'html';
    let guideSlug = raw;
    if (raw.endsWith('.json')) {
      format = 'json';
      guideSlug = raw.slice(0, -5);
    } else if (raw.endsWith('.md')) {
      format = 'md';
      guideSlug = raw.slice(0, -3);
    } else if (wantsMarkdown(req)) {
      format = 'md';
    } else if (wantsJson(req)) {
      format = 'json';
    }
    await serveGuide(req, res, { hubSlug: req.params.hub, guideSlug, format });
  } catch (err) {
    next(err);
  }
});

app.get('/g/:hub/:guide/:format(md|json)', async (req, res, next) => {
  try {
    const found = await loadGuide(req.params.hub, req.params.guide);
    if (!found || !found.version) return res.status(404).type('html').send(renderNotFound());
    const { guide, version } = found;
    const base = baseUrlOf(req);
    const guidePath = `/g/${guide.hub_slug}/${guide.slug}`;
    const format = req.params.format;
    const source =
      format === 'md'
        ? specToMarkdown(version.spec, {
            baseUrl: base,
            guidePath,
            version: version.version,
            attestation: version
          })
        : JSON.stringify(guideJson(guide, version, base, guidePath), null, 2);
    res.type('html').send(renderCodeView({ guide, version, format, source, baseUrl: base, guidePath }));
  } catch (err) {
    next(err);
  }
});

app.get('/g/:hub/:guide/v/:version', async (req, res, next) => {
  try {
    const n = Number.parseInt(req.params.version.replace(/^v/, ''), 10);
    if (!Number.isFinite(n)) return res.status(400).type('html').send(renderNotFound());
    await serveGuide(req, res, {
      hubSlug: req.params.hub,
      guideSlug: req.params.guide,
      format: wantsMarkdown(req) ? 'md' : wantsJson(req) ? 'json' : 'html',
      versionNumber: n
    });
  } catch (err) {
    next(err);
  }
});

/* ----------------------------------------------------------------------- mcp */

app.all('/mcp', async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'GET' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  await handleMcpRequest(req, res, { baseUrl: baseUrlOf(req) });
});

/* ------------------------------------------------------------------- builder */

mountBuilder(app, { baseUrlOf });

/* ------------------------------------------------------------------ fallback */

app.use((req, res) => {
  res.status(404).type('html').send(renderNotFound());
});

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  if (res.headersSent) return;
  res.status(500).type('html').send(
    renderNotFound()
  );
});

try {
  if (process.env.DATABASE_URL) {
    await migrate();
    console.log('[boot] schema ready');
  } else {
    console.warn('[boot] DATABASE_URL not set, serving seed guides read-only');
  }
} catch (err) {
  console.error('[boot] migration failed, continuing on seed guides:', err.message);
}

await initHighlight();

app.listen(PORT, () => console.log(`[boot] listening on ${PORT}`));
