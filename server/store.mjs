/**
 * Data access with a file fallback.
 *
 * The prototype has to demo whether or not Postgres is wired, so every read falls
 * back to the seed guides in /seed when the database is unavailable. Writes need
 * the database and say so plainly.
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import { query, many, one } from './db.mjs';

const seedDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed');

let dbUp = null;
let seedCache = null;

export function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export async function dbAvailable() {
  if (dbUp !== null) return dbUp;
  if (!process.env.DATABASE_URL) {
    dbUp = false;
    return dbUp;
  }
  try {
    await query('SELECT 1');
    dbUp = true;
  } catch (err) {
    console.warn('[store] database unavailable, serving seed guides read-only:', err.message);
    dbUp = false;
  }
  return dbUp;
}

/** Force a re-check, used after the environment changes. */
export function resetDbProbe() {
  dbUp = null;
}

async function seedFiles() {
  const out = [];
  for (const dir of [seedDir, path.join(seedDir, 'generated')]) {
    try {
      for (const f of await readdir(dir)) {
        if (f.endsWith('.json')) out.push(path.join(dir, f));
      }
    } catch {
      // A missing generated folder just means nothing has been built yet.
    }
  }
  return out;
}

async function loadSeeds() {
  if (seedCache) return seedCache;
  const out = [];
  const files = await seedFiles();
  for (const f of files) {
    try {
      const spec = JSON.parse(await readFile(f, 'utf8'));
      const g = spec.guide || {};
      const hubSlug = g.hub?.slug || 'hub';
      const slug = `${String(g.transactionSet || 'guide').toLowerCase()}-${String(g.version || '').toLowerCase()}`;
      const att = g.attestation || { name: 'Dana Whitfield', role: 'Director, EDI Operations', date: '2026-03-18' };
      out.push({
        guide: {
          id: `seed_${path.basename(f).replace(/\.json$/, '')}`,
          hub_id: `seed_${hubSlug}`,
          hub_slug: hubSlug,
          hub_name: g.hub?.name || hubSlug,
          hub_industry: g.hub?.industry || null,
          slug,
          title: g.title || '',
          standard: g.standard || 'X12',
          transaction_set: g.transactionSet || '',
          std_version: g.version || '',
          direction: g.direction || 'partner_sends',
          summary: g.summary || '',
          visibility: 'public'
        },
        version: {
          id: `seedv_${f}`,
          version: 1,
          status: 'published',
          spec,
          source_name: g.supersedes || null,
          source_pages: g.sourcePages || 34,
          compiled_by: 'seed',
          changelog: 'Initial structured publication of the hub\u2019s requirements.',
          attested_by: att.name,
          attested_role: att.role,
          attested_at: `${att.date}T00:00:00.000Z`,
          published_at: `${att.date}T00:00:00.000Z`
        }
      });
    } catch (err) {
      console.warn(`[store] could not load seed ${f}:`, err.message);
    }
  }
  seedCache = out;
  return out;
}

export async function listGuides({ includeUnlisted = false } = {}) {
  if (await dbAvailable()) {
    const rows = await many(
      `SELECT g.*, h.slug AS hub_slug, h.name AS hub_name,
              v.version AS cur_version, v.published_at, v.attested_by
         FROM guides g
         JOIN hubs h ON h.id = g.hub_id
         LEFT JOIN LATERAL (
           SELECT version, published_at, attested_by FROM guide_versions
            WHERE guide_id = g.id AND status = 'published'
            ORDER BY version DESC LIMIT 1
         ) v ON TRUE
        WHERE v.version IS NOT NULL
          AND ($1::boolean OR g.visibility = 'public')
        ORDER BY h.name, g.transaction_set`,
      [includeUnlisted]
    );
    if (rows.length) return rows;
  }
  const seeds = await loadSeeds();
  return seeds
    .map((s) => ({
      ...s.guide,
      cur_version: s.version.version,
      published_at: s.version.published_at,
      attested_by: s.version.attested_by
    }))
    .sort((a, b) => a.hub_name.localeCompare(b.hub_name) || a.transaction_set.localeCompare(b.transaction_set));
}

export async function getGuide(hubSlug, guideSlug) {
  if (await dbAvailable()) {
    const row = await one(
      `SELECT g.*, h.slug AS hub_slug, h.name AS hub_name, h.legal_name, h.industry
         FROM guides g JOIN hubs h ON h.id = g.hub_id
        WHERE h.slug = $1 AND g.slug = $2`,
      [hubSlug, guideSlug]
    );
    if (row) return row;
  }
  const seeds = await loadSeeds();
  const hit = seeds.find((s) => s.guide.hub_slug === hubSlug && s.guide.slug === guideSlug);
  return hit ? hit.guide : null;
}

export async function getVersion(guideId, versionNumber = null) {
  if (await dbAvailable() && !String(guideId).startsWith('seed_')) {
    if (versionNumber) {
      return one(`SELECT * FROM guide_versions WHERE guide_id = $1 AND version = $2`, [guideId, versionNumber]);
    }
    return one(
      `SELECT * FROM guide_versions WHERE guide_id = $1 AND status = 'published'
        ORDER BY version DESC LIMIT 1`,
      [guideId]
    );
  }
  const seeds = await loadSeeds();
  const hit = seeds.find((s) => s.guide.id === guideId);
  return hit ? hit.version : null;
}

export async function listVersions(guideId) {
  if (await dbAvailable() && !String(guideId).startsWith('seed_')) {
    return many(
      `SELECT version, status, changelog, published_at, attested_by, attested_at
         FROM guide_versions WHERE guide_id = $1 ORDER BY version DESC`,
      [guideId]
    );
  }
  const seeds = await loadSeeds();
  const hit = seeds.find((s) => s.guide.id === guideId);
  return hit ? [hit.version] : [];
}

const AGENT_HINTS = [
  [/claude/i, 'Claude'],
  [/gptbot|chatgpt|openai/i, 'OpenAI'],
  [/anthropic/i, 'Anthropic'],
  [/cursor/i, 'Cursor'],
  [/copilot/i, 'Copilot'],
  [/perplexity/i, 'Perplexity'],
  [/python-requests|httpx|aiohttp/i, 'Python client'],
  [/curl|wget/i, 'Command line'],
  [/node-fetch|undici|axios/i, 'Node client'],
  [/go-http-client/i, 'Go client'],
  [/java|okhttp/i, 'Java client'],
  [/bot|crawler|spider/i, 'Crawler']
];

export function classifyClient(userAgent = '', surface = 'page') {
  const ua = String(userAgent || '');
  if (surface === 'mcp') return { kind: 'agent', name: 'MCP client' };
  for (const [re, name] of AGENT_HINTS) {
    if (re.test(ua)) return { kind: 'agent', name };
  }
  if (/mozilla|safari|chrome|firefox|edge/i.test(ua)) return { kind: 'browser', name: 'Browser' };
  return { kind: 'unknown', name: ua ? ua.slice(0, 40) : 'Unidentified' };
}

export async function logRead({ guideId, version, surface, tool = null, userAgent = '' }) {
  if (!(await dbAvailable())) return;
  if (String(guideId || '').startsWith('seed_')) return;
  const { kind, name } = classifyClient(userAgent, surface);
  try {
    await query(
      `INSERT INTO guide_reads (guide_id, version, surface, tool, client_kind, client_name)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [guideId, version, surface, tool, kind, name]
    );
  } catch (err) {
    // Readership is evidence, not a dependency. Never fail a read because of it.
    console.warn('[store] read log failed:', err.message);
  }
}

export async function readCount(guideId) {
  if (!(await dbAvailable())) return null;
  if (String(guideId || '').startsWith('seed_')) return null;
  const row = await one(`SELECT count(*)::int AS n FROM guide_reads WHERE guide_id = $1`, [guideId]);
  return row?.n ?? 0;
}

export async function readership(hubSlug) {
  if (!(await dbAvailable())) return null;
  const rows = await many(
    `SELECT g.slug, g.transaction_set, r.surface, r.client_kind, r.client_name,
            r.version, count(*)::int AS reads, max(r.read_at) AS last_read
       FROM guide_reads r
       JOIN guides g ON g.id = r.guide_id
       JOIN hubs h ON h.id = g.hub_id
      WHERE h.slug = $1
      GROUP BY g.slug, g.transaction_set, r.surface, r.client_kind, r.client_name, r.version
      ORDER BY reads DESC
      LIMIT 200`,
    [hubSlug]
  );
  return rows;
}

export async function guidePathFor(guide) {
  return `/g/${guide.hub_slug}/${guide.slug}`;
}
