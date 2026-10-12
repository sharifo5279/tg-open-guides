/**
 * Background compilation.
 *
 * The upload request extracts the PDF, stores the pages and returns. The model
 * compile runs here, in the server process, and writes progress to the import
 * row, so the page can be closed and reopened. Pages and metadata live on the
 * row, so a compile cut off by a restart starts again on boot.
 */
import { query, one } from './db.mjs';
import { compileGuide } from './compile.mjs';

const MAX_ATTEMPTS = 3;
const running = new Set();

export async function appendLog(id, line) {
  const entry = { at: new Date().toISOString(), line };
  await query(`UPDATE imports SET log = log || $2::jsonb, updated_at = now() WHERE id = $1`, [
    id,
    JSON.stringify([entry])
  ]);
}

async function fail(id, error) {
  await query(`UPDATE imports SET status = 'failed', error = $2, updated_at = now() WHERE id = $1`, [id, error]);
  await appendLog(id, `Failed: ${error}`);
}

async function run(id) {
  const imp = await one(
    `UPDATE imports SET attempts = attempts + 1, updated_at = now()
      WHERE id = $1 AND status = 'compiling' RETURNING *`,
    [id]
  );
  if (!imp) return;
  if (imp.attempts > MAX_ATTEMPTS) {
    return fail(id, `Stopped after ${MAX_ATTEMPTS} attempts. Import the PDF again.`);
  }
  if (imp.attempts > 1) await appendLog(id, `Restarted after a server restart (attempt ${imp.attempts} of ${MAX_ATTEMPTS}).`);

  try {
    const spec = await compileGuide(imp.page_text || [], imp.meta || {}, {
      onProgress: (line) => appendLog(id, line)
    });
    const report = spec.compileReport || {};
    await query(
      `UPDATE imports SET status = 'ready', spec = $2, compiled_by = $3, error = NULL, updated_at = now() WHERE id = $1`,
      [id, JSON.stringify(spec), report.compiledBy || 'unknown']
    );
    await appendLog(
      id,
      `Complete: ${spec.segments?.length || 0} segments, ${spec.rules?.length || 0} rules, ${report.failedChunks || 0} failed chunks.`
    );
  } catch (err) {
    console.error(`[jobs] compile ${id} failed:`, err.message);
    await fail(id, err.message.slice(0, 300));
  }
}

export function startCompile(id) {
  if (running.has(id)) return;
  running.add(id);
  run(id)
    .catch((err) => console.error(`[jobs] compile ${id} errored:`, err.message))
    .finally(() => running.delete(id));
}

/* On boot: restart compiles a previous process left running. An import cut off
   during extraction has no stored pages, so it fails. */
export async function resumeCompiles() {
  await query(
    `UPDATE imports SET status = 'failed', error = 'Interrupted during extraction. Import the PDF again.', updated_at = now()
      WHERE status = 'extracting'`
  );
  const { rows } = await query(`SELECT id FROM imports WHERE status = 'compiling' ORDER BY created_at`);
  for (const r of rows) startCompile(r.id);
  return rows.length;
}
