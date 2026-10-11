/**
 * Writes every hub guide to seed/generated as JSON.
 *
 * The hand-authored Crestfield 856 stays where it is and is not regenerated: it
 * is the reference for how much a hub guide can say when a person writes it, and
 * the generated ones should be read against it.
 */
import { mkdir, writeFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HUBS } from './lib/hubs.mjs';
import { composeGuide, guideSlug } from './lib/compose.mjs';
import { validateSpec, specStats } from '../server/spec.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'generated');

await mkdir(outDir, { recursive: true });
for (const f of await readdir(outDir).catch(() => [])) {
  if (f.endsWith('.json')) await rm(path.join(outDir, f));
}

let written = 0;
let problems = 0;
const totals = { segments: 0, elements: 0, rules: 0, scenarios: 0 };

for (const hub of HUBS) {
  for (const ts of Object.keys(hub.sets)) {
    const spec = composeGuide(hub, ts);
    const check = validateSpec(spec);
    if (!check.ok) {
      problems += 1;
      console.error(`invalid: ${hub.slug} ${ts}`);
      for (const e of check.errors.slice(0, 5)) console.error(`   ${e}`);
      continue;
    }
    const stats = specStats(spec);
    totals.segments += stats.segments;
    totals.elements += stats.elements;
    totals.rules += stats.rules;
    totals.scenarios += stats.scenarios;

    const name = `${hub.slug}-${guideSlug(ts, hub.stdVersion)}.json`;
    await writeFile(path.join(outDir, name), JSON.stringify(spec, null, 2) + '\n');
    written += 1;
  }
}

console.log(`wrote ${written} guides to seed/generated${problems ? `, ${problems} invalid and skipped` : ''}`);
console.log(`totals: ${totals.segments} segments, ${totals.elements} elements, ${totals.rules} rules, ${totals.scenarios} scenarios`);
if (problems) process.exitCode = 1;
