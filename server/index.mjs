import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { migrate, dbReady } from './db.mjs';
import {
  listGuides,
  getGuide,
  getVersion,
  listVersions,
  logRead,
  readCount,
  readership,
  dbAvailable
} from './store.mjs';
import { specToMarkdown, DIRECTIONS } from './spec.mjs';
import { renderGuidePage } from './render/guide.mjs';
import { renderCatalogue, renderForAgents, renderReadership, renderNotFound, renderSamples } from './render/pages.mjs';
import { generateSamples, samplesReadme } from './samples.mjs';
import { handleMcpRequest } from './mcp.mjs';
import { mountBuilder } from './builder.mjs';

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
app.use('/static', express.static(path.join(here, '..', 'public'), { maxAge: '1h' }));

app.get('/healthz', async (_req, res) => {
  res.json({ ok: true, db: await dbReady() });
});

/* ---------------------------------------------------------------- catalogue */

app.get('/', async (req, res, next) => {
  try {
    const guides = await listGuides({ includeUnlisted: false });
    res.type('html').send(renderCatalogue({ guides, baseUrl: baseUrlOf(req), dbUp: await dbAvailable() }));
  } catch (err) {
    next(err);
  }
});

app.get('/for-agents', async (req, res, next) => {
  try {
    const guides = await listGuides({ includeUnlisted: false });
    res.type('html').send(renderForAgents({ guides, baseUrl: baseUrlOf(req) }));
  } catch (err) {
    next(err);
  }
});

/**
 * The catalogue for an agent that has only crawled the domain. Kept deliberately
 * small: a list of guides and the three ways to read one.
 */
app.get('/llms.txt', async (req, res, next) => {
  try {
    const base = baseUrlOf(req);
    const guides = await listGuides({ includeUnlisted: false });
    const lines = [
      '# Trading Grid Open Guides',
      '',
      '> EDI implementation guides published and attested by the buyer hub that owns them.',
      '> Each guide states what one hub requires of its trading partners for one transaction',
      '> set, which is information the X12 and EDIFACT standards do not contain.',
      '',
      'This service publishes requirements. It does not validate, test or certify a file you',
      'have built, and it cannot tell you whether a hub will accept your transaction.',
      '',
      '## How to read a guide',
      '',
      `- Markdown: append .md to any guide path, or send Accept: text/markdown`,
      `- JSON: append .json to any guide path`,
      `- MCP (streamable HTTP): ${base}/mcp`,
      `  tools: search_guides, get_guide_summary, get_rules, get_segment, get_code_list, get_guide_markdown`,
      '',
      '## Guides',
      ''
    ];
    for (const g of guides) {
      lines.push(
        `- [${g.hub_name}: ${g.standard} ${g.transaction_set} ${g.std_version}](${base}/g/${g.hub_slug}/${g.slug}.md): ${DIRECTIONS[g.direction] || g.direction}. Guide v${g.cur_version}${g.attested_by ? `, attested by ${g.attested_by}` : ', not attested'}. ${String(g.summary || '').slice(0, 160)}`
      );
    }
    lines.push('');
    res.type('text/plain; charset=utf-8').send(lines.join('\n'));
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
    await logRead({ guideId: guide.id, version: version.version, surface: 'json', userAgent: ua });
    res.set('Access-Control-Allow-Origin', '*');
    return res.json({
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
    });
  }

  if (format === 'md') {
    await logRead({ guideId: guide.id, version: version.version, surface: 'markdown', userAgent: ua });
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

  await logRead({ guideId: guide.id, version: version.version, surface: 'page', userAgent: ua });
  const versions = await listVersions(guide.id);
  res.type('html').send(
    renderGuidePage({
      spec: version.spec,
      guide,
      version,
      versions,
      baseUrl: base,
      guidePath,
      readCount: await readCount(guide.id)
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

app.get('/g/:hub/:guide/samples', async (req, res, next) => {
  try {
    const found = await loadGuide(req.params.hub, req.params.guide);
    if (!found?.version) return res.status(404).type('html').send(renderNotFound());
    const samples = generateSamples(found.version.spec);
    await logRead({ guideId: found.guide.id, version: found.version.version, surface: 'samples', userAgent: req.get('user-agent') || '' });
    res.type('html').send(renderSamples({ guide: found.guide, version: found.version, samples, baseUrl: baseUrlOf(req) }));
  } catch (err) { next(err); }
});

app.get('/g/:hub/:guide/samples/:id.edi', async (req, res, next) => {
  try {
    const found = await loadGuide(req.params.hub, req.params.guide);
    if (!found?.version) return res.status(404).type('text/plain').send('not found');
    const id = req.params.id;
    const hit = generateSamples(found.version.spec).find((s) => s.id === id);
    if (!hit) return res.status(404).type('text/plain').send('no such scenario');
    await logRead({ guideId: found.guide.id, version: found.version.version, surface: 'samples', tool: id, userAgent: req.get('user-agent') || '' });
    res.set('content-disposition', `attachment; filename="${found.guide.hub_slug}-${found.guide.slug}-${id}.edi"`);
    res.type('text/plain; charset=utf-8').send(hit.edi + '\n');
  } catch (err) { next(err); }
});

app.get('/g/:hub/:guide/samples.md', async (req, res, next) => {
  try {
    const found = await loadGuide(req.params.hub, req.params.guide);
    if (!found?.version) return res.status(404).type('text/plain').send('not found');
    const samples = generateSamples(found.version.spec);
    const md = [samplesReadme(found.version.spec, samples), '', ...samples.map((s) => `## ${s.id} ${s.name}\n\n\`\`\`\n${s.edi}\n\`\`\`\n`)].join('\n');
    await logRead({ guideId: found.guide.id, version: found.version.version, surface: 'samples', userAgent: req.get('user-agent') || '' });
    res.type('text/markdown; charset=utf-8').send(md);
  } catch (err) { next(err); }
});

app.get('/hub/:hub/readership', async (req, res, next) => {
  try {
    const rows = await readership(req.params.hub);
    res.type('html').send(renderReadership({ hubSlug: req.params.hub, rows, baseUrl: baseUrlOf(req) }));
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

app.listen(PORT, () => console.log(`[boot] listening on ${PORT}`));
