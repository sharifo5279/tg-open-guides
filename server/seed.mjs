/**
 * Load the sample guides in /seed into the database as published, attested versions.
 * Idempotent: re-running updates the spec of version 1 rather than stacking versions.
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { query, one, getPool, migrate } from './db.mjs';
import { newId } from './store.mjs';
import { validateSpec } from './spec.mjs';

const seedDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed');

const ATTESTOR = { name: 'Dana Whitfield', role: 'Director, EDI Operations' };

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function main() {
  await migrate();
  const files = (await readdir(seedDir)).filter((f) => f.endsWith('.json'));
  if (!files.length) {
    console.log('no seed files');
    return;
  }

  for (const file of files) {
    const spec = JSON.parse(await readFile(path.join(seedDir, file), 'utf8'));
    const check = validateSpec(spec);
    if (!check.ok) {
      console.error(`${file}: spec is not valid, skipping`);
      for (const e of check.errors) console.error(`  ${e}`);
      continue;
    }
    if (check.warnings.length) {
      console.warn(`${file}: ${check.warnings.length} warning(s), first: ${check.warnings[0]}`);
    }

    const g = spec.guide;
    const hubSlug = g.hub.slug || slugify(g.hub.name);
    let hub = await one('SELECT * FROM hubs WHERE slug = $1', [hubSlug]);
    if (!hub) {
      const id = newId('hub');
      await query(
        'INSERT INTO hubs (id, slug, name, legal_name, industry) VALUES ($1,$2,$3,$4,$5)',
        [id, hubSlug, g.hub.name, g.hub.legalName || null, g.hub.industry || null]
      );
      hub = { id };
    }

    const guideSlug = `${String(g.transactionSet).toLowerCase()}-${String(g.version).toLowerCase()}`;
    let guide = await one('SELECT * FROM guides WHERE hub_id = $1 AND slug = $2', [hub.id, guideSlug]);
    if (!guide) {
      const id = newId('gd');
      await query(
        `INSERT INTO guides (id, hub_id, slug, title, standard, transaction_set, std_version, direction, summary, visibility)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'public')`,
        [id, hub.id, guideSlug, g.title, g.standard, g.transactionSet, g.version, g.direction, g.summary || '']
      );
      guide = { id };
    } else {
      await query('UPDATE guides SET title=$2, summary=$3 WHERE id=$1', [guide.id, g.title, g.summary || '']);
    }

    const existing = await one('SELECT * FROM guide_versions WHERE guide_id = $1 AND version = 1', [guide.id]);
    if (existing) {
      await query('UPDATE guide_versions SET spec = $2 WHERE id = $1', [existing.id, JSON.stringify(spec)]);
      console.log(`${file}: updated ${hubSlug}/${guideSlug} v1`);
    } else {
      await query(
        `INSERT INTO guide_versions
           (id, guide_id, version, status, spec, source_name, source_pages, compiled_by, changelog,
            attested_by, attested_role, attested_at, published_at)
         VALUES ($1,$2,1,'published',$3,$4,$5,'seed',$6,$7,$8,now(),now())`,
        [
          newId('gv'), guide.id, JSON.stringify(spec),
          g.supersedes || 'hand-authored sample', 34,
          'Initial structured publication of the hub’s requirements.',
          ATTESTOR.name, ATTESTOR.role
        ]
      );
      console.log(`${file}: published ${hubSlug}/${guideSlug} v1`);
    }
  }
}

try {
  await main();
} catch (err) {
  console.error('seed failed:', err.message);
  process.exitCode = 1;
} finally {
  await getPool().end().catch(() => {});
}
