/**
 * Guide Builder: import, review, publish, attest.
 *
 * The review screen is the product. A 60-page guide compiles to a few hundred items,
 * and a reviewer who is asked to confirm all of them abandons the task. So the screen
 * leads with what the compiler could not find, then the items it is unsure about, and
 * collapses what it is confident about behind a count.
 *
 * Attestation is a separate page. While the platform is single-operator it requires
 * the platform administrator, who records the hub signatory's name and role.
 */
import express from 'express';
import multer from 'multer';
import { esc, layout, citeTag } from './render/html.mjs';
import { extractPages, detectTransactionSets, detectStandardVersion } from './extract.mjs';
import { specStats, USAGE } from './spec.mjs';
import { renderReview } from './render/review.mjs';
import { prepareForReview, findByFid, findingsSummary, publishableSpec, REVIEW_STATES } from './findings.mjs';
import { modelAvailable, modelName } from './model.mjs';
import { query, one, many } from './db.mjs';
import { dbAvailable, newId } from './store.mjs';
import { requirePlatformAdmin } from './auth.mjs';
import { appendLog, startCompile } from './jobs.mjs';

const form = express.urlencoded({ extended: false });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 }
});

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/* ------------------------------------------------------------------ screens */

function builderHome({ imports, dbUp, baseUrl }) {
  const body = `
<div class="phead"><div class="shell">
  <p class="eyebrow">Guide Builder</p>
  <h1>Import a guide</h1>
  <p class="lede">Upload the hub's PDF. The compiler drafts a structured guide with every item cited to its source page. You correct it, the hub attests it, it publishes.</p>
</div></div>

${!dbUp ? `<section class="section"><div class="shell"><div class="notice">The database is not connected, so importing and publishing are disabled.</div></div></section>` : ''}

<section class="section"><div class="shell"><div class="twocol">
  <div>
    <h2>Source document</h2>
    <p class="section-sub">A text PDF of one transaction set. Scanned documents will not compile.</p>
    <form method="post" action="/builder/import" enctype="multipart/form-data" class="form">
      <label>Hub name
        <input name="hubName" required placeholder="Crestfield Consumer Brands" ${dbUp ? '' : 'disabled'}>
      </label>
      <label>Guide title
        <input name="title" placeholder="Advance Ship Notice (856) supplier requirements" ${dbUp ? '' : 'disabled'}>
      </label>
      <div class="formrow">
        <label>Transaction set
          <input name="transactionSet" placeholder="856" ${dbUp ? '' : 'disabled'}>
        </label>
        <label>Standard
          <select name="standard" ${dbUp ? '' : 'disabled'}>
            <option value="X12">X12</option>
            <option value="EDIFACT">EDIFACT</option>
          </select>
        </label>
        <label>Version
          <input name="version" placeholder="004010" ${dbUp ? '' : 'disabled'}>
        </label>
      </div>
      <label>Direction
        <select name="direction" ${dbUp ? '' : 'disabled'}>
          <option value="partner_sends">Partner sends to hub</option>
          <option value="partner_receives">Partner receives from hub</option>
        </select>
      </label>
      <label>Source PDF
        <input type="file" name="pdf" accept="application/pdf" required ${dbUp ? '' : 'disabled'}>
      </label>
      <p class="rc-note">Leave transaction set, standard or version blank to detect them from the document.</p>
      <button class="btn" type="submit" ${dbUp ? '' : 'disabled'}>Compile draft</button>
    </form>
  </div>
  <div class="tint">
    <h3>Compiler</h3>
    <p class="rc-note">${modelAvailable()
      ? `Model configured: <code>${esc(modelName())}</code>. The compiler reads the document in overlapping windows and cites every item it emits.`
      : 'No model key is set, so the importer falls back to a structural compiler: it recognises segments and elements by shape and pulls candidate rules from obligation sentences. Usable, noticeably cruder. Set <code>ANTHROPIC_API_KEY</code> or <code>GEMINI_API_KEY</code> to improve it.'}</p>
    <h3 style="margin-top:16px">Compiler limitations</h3>
    <p class="rc-note">It never invents a requirement or cites a page it was not shown. Anything it cannot attribute is dropped and reported as a gap.</p>
  </div>
</div></div></section>

${imports?.length ? `<section class="section"><div class="shell">
  <h2>Recent imports</h2>
  <div class="tbl-wrap"><table class="tbl">
  <thead><tr><th>Source</th><th>Hub</th><th>Status</th><th>Review</th><th>Published</th><th>Pages</th><th></th></tr></thead>
  <tbody>${imports.map((i) => {
    const sum = i.status === 'ready' && i.spec ? findingsSummary(i.spec) : null;
    const status = i.status === 'ready' ? (i.published_version ? 'Published' : sum && sum.reviewed === sum.total ? 'Reviewed' : 'In review') : i.status;
    return `<tr>
    <td>${esc(i.source_name)}</td>
    <td>${esc(i.hub_name || i.spec?.guide?.hub?.name || '-')}</td>
    <td>${esc(status)}${i.error ? ` <span class="rc-note">${esc(String(i.error).slice(0, 80))}</span>` : ''}</td>
    <td class="mono">${sum ? `${sum.reviewed}/${sum.total}` : '-'}</td>
    <td class="mono">${i.published_version ? `v${esc(i.published_version)}${i.attested_at ? '' : ' (unattested)'}` : '-'}</td>
    <td class="mono">${esc(i.pages ?? '-')}</td>
    <td><a href="/builder/i/${esc(i.id)}">${i.status === 'ready' ? (i.published_version ? 'Open review' : 'Resume review') : i.status === 'failed' ? 'View log' : 'View progress'}</a></td>
  </tr>`;
  }).join('')}</tbody></table></div>
</div></section>` : ''}

<style>
.form label { display:block; font-size:14px; font-weight:600; color:var(--ink); margin-bottom:12px; }
.form input, .form select, .form textarea { display:block; width:100%; margin-top:4px; font:300 15px/1.4 var(--sans); color:var(--ink); padding:9px 12px; border:1px solid var(--line); border-radius:8px; background:#fff; font-weight:400; }
.form input:focus, .form select:focus, .form textarea:focus { outline:2px solid var(--primary); outline-offset:-1px; border-color:var(--primary); }
.formrow { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
@media (max-width:640px){ .formrow { grid-template-columns:1fr; } }
</style>`;

  return layout({ title: 'Guide Builder | Trading Grid Open Guides', body, canonical: `${baseUrl}/builder` });
}

function attestScreen({ guide, version, baseUrl, done = false }) {
  const spec = version.spec;
  const stats = specStats(spec);
  const allRules = spec.rules || [];
  const body = `
<div class="phead"><div class="shell">
  <p class="eyebrow">${esc(guide.hub_name)}</p>
  <h1>${done ? 'Attested' : 'Attest these requirements'}</h1>
  <p class="lede">${done
    ? `Version ${esc(version.version)} is attested and published.`
    : `Confirm that this document states ${esc(guide.hub_name)} requirements for ${esc(spec.guide.standard)} ${esc(spec.guide.transactionSet)} as of today.`}</p>
</div></div>

<section class="section"><div class="shell">
  <h2>Attestation scope</h2>
  <ul class="stats">
    <li><span class="s-num">${stats.requiredSegments}</span><span class="s-lab">required segments</span></li>
    <li><span class="s-num">${stats.requiredElements}</span><span class="s-lab">required elements</span></li>
    <li><span class="s-num">${stats.rules}</span><span class="s-lab">enforced rules</span></li>
    <li><span class="s-num">${Math.round(stats.citedFraction * 100)}%</span><span class="s-lab">items cite a source page</span></li>
  </ul>
  <h3 style="margin-top:22px">Rules you are attesting</h3>
  <ul class="rules">${allRules.map((r) => `<li class="rule">
    <div class="rule-head"><span class="rule-id">${esc(r.id)}</span>${citeTag(r.citation)}</div>
    <p class="rule-stmt">${esc(r.statement)}</p>
  </li>`).join('')}</ul>
  <p class="section-sub"><a href="/g/${esc(guide.hub_slug)}/${esc(guide.slug)}/v/${esc(version.version)}">View full version ${esc(version.version)}</a></p>
</div></section>

${done ? `<section class="section"><div class="shell">
  <div class="attested">
    <span class="att-label">Attested by ${esc(version.attested_by)}${version.attested_role ? `, ${esc(version.attested_role)}` : ''}</span>
    <span class="att-meta">on ${esc(String(version.attested_at).slice(0, 10))}.</span>
  </div>
  <div class="copyrow"><a class="btn" href="/g/${esc(guide.hub_slug)}/${esc(guide.slug)}">View the published guide</a></div>
</div></section>`
    : `<section class="section"><div class="shell"><div class="twocol">
  <div>
    <h2>Sign</h2>
    <form method="post" action="/attest/${esc(version.id)}" class="form">
      <label>Your name <input name="name" required placeholder="Dana Whitfield"></label>
      <label>Your role at ${esc(guide.hub_name)} <input name="role" required placeholder="Director, EDI Operations"></label>
      <label style="font-weight:400;font-size:14px">
        <input type="checkbox" name="confirm" value="yes" required style="width:auto;display:inline-block;margin-right:8px">
        I confirm these are ${esc(guide.hub_name)} requirements for this transaction set as of today, and that OpenText may publish them as attested by me.
      </label>
      <button class="btn" type="submit">Attest and publish</button>
    </form>
  </div>
  <div class="tint">
    <h3>Attestation terms</h3>
    <p class="rc-note">The published page names you and the date. It does not make OpenText a guarantor, and it certifies no partner. A requirements change publishes a new version; this one stays readable mid-build.</p>
  </div>
</div></div></section>`}

<style>
.form label { display:block; font-size:14px; font-weight:600; color:var(--ink); margin-bottom:14px; }
.form input { display:block; width:100%; margin-top:4px; font:400 15px/1.4 var(--sans); color:var(--ink); padding:9px 12px; border:1px solid var(--line); border-radius:8px; background:#fff; }
</style>`;
  return layout({ title: `Attest | ${guide.hub_name}`, body, canonical: `${baseUrl}/attest/${version.id}` });
}

function progressScreen(imp) {
  const running = imp.status === 'compiling' || imp.status === 'extracting';
  const time = (at) => String(at || '').slice(11, 19);
  const lines = (imp.log || []).map((e) => `${time(e.at)}  ${e.line}`).join('\n');
  const lede = running
    ? 'Compilation runs on the server. You can close this page and return later.'
    : imp.error || 'Compilation stopped.';
  const body = `
<div class="phead"><div class="shell">
  <h1>${esc(imp.source_name)}</h1>
  <ul class="specline">
    <li>Status: <b>${esc(imp.status)}</b></li>
    ${imp.pages ? `<li>${esc(imp.pages)} pages</li>` : ''}
    <li>Started ${esc(String(imp.created_at ? new Date(imp.created_at).toISOString() : '').slice(0, 16).replace('T', ' '))} UTC</li>
  </ul>
  <p class="lede">${esc(lede)}</p>
</div></div>
<section class="section"><div class="shell">
  <h2>Compiler log</h2>
  <pre>${esc(lines || 'Waiting for the compiler.')}</pre>
  <div class="copyrow"><a class="btn btn-outline" href="/builder">Guide Builder</a></div>
</div></section>`;
  return layout({
    title: `${imp.status === 'failed' ? 'Import failed' : 'Compiling'} | Trading Grid Open Guides`,
    head: running ? '<meta http-equiv="refresh" content="5">' : '',
    body
  });
}

function message({ title, lede, links = [] }) {
  return layout({
    title: `${title} | Trading Grid Open Guides`,
    body: `<div class="phead"><div class="shell"><h1>${esc(title)}</h1><p class="lede">${esc(lede)}</p>
<div class="copyrow">${links.map((l) => `<a class="btn btn-outline" href="${esc(l.href)}">${esc(l.label)}</a>`).join('')}</div></div></div>`
  });
}

/* ------------------------------------------------------------------- routes */

export function mountBuilder(app, { baseUrlOf }) {
  /* The builder runs the authoring agent on the platform model key. */
  app.use('/builder', requirePlatformAdmin);
  app.use('/attest', requirePlatformAdmin);
  app.get('/builder', async (req, res, next) => {
    try {
      const dbUp = await dbAvailable();
      let imports = [];
      if (dbUp) {
        imports = await many(
          `SELECT i.id, i.source_name, i.status, i.error, i.pages, i.compiled_by, i.created_at, i.spec,
                  h.name AS hub_name,
                  (SELECT max(v.version) FROM guide_versions v WHERE v.import_id = i.id) AS published_version,
                  (SELECT max(v.attested_at) FROM guide_versions v WHERE v.import_id = i.id) AS attested_at
             FROM imports i
             LEFT JOIN hubs h ON h.id = i.hub_id
            ORDER BY i.created_at DESC LIMIT 12`
        );
      }
      res.type('html').send(builderHome({ imports, dbUp, baseUrl: baseUrlOf(req) }));
    } catch (err) {
      next(err);
    }
  });

  app.post('/builder/import', upload.single('pdf'), async (req, res, next) => {
    try {
      if (!(await dbAvailable())) {
        return res.status(503).type('html').send(
          message({ title: 'Database not connected', lede: 'Importing needs the database. The site is running on seeded guides.', links: [{ href: '/builder', label: 'Back' }] })
        );
      }
      if (!req.file?.buffer?.length) {
        return res.status(400).type('html').send(
          message({ title: 'No file', lede: 'Attach a PDF of the hub’s implementation guide.', links: [{ href: '/builder', label: 'Back' }] })
        );
      }

      const importId = newId('imp');
      const sourceName = req.file.originalname || 'guide.pdf';
      await query(
        `INSERT INTO imports (id, source_name, status) VALUES ($1,$2,'extracting')`,
        [importId, sourceName]
      );

      let extracted;
      try {
        extracted = await extractPages(req.file.buffer);
      } catch (err) {
        await query(`UPDATE imports SET status='failed', error=$2, updated_at=now() WHERE id=$1`, [importId, `extraction failed: ${err.message}`]);
        return res.status(422).type('html').send(
          message({ title: 'Could not read that PDF', lede: err.message, links: [{ href: '/builder', label: 'Back' }] })
        );
      }

      if (extracted.looksScanned) {
        await query(`UPDATE imports SET status='failed', error=$2, pages=$3, updated_at=now() WHERE id=$1`, [
          importId,
          'The document has almost no extractable text, so it is probably scanned images. Compiling it would produce nonsense.',
          extracted.totalPages
        ]);
        return res.status(422).type('html').send(
          message({
            title: 'That looks like a scanned PDF',
            lede: 'Almost no extractable text, so the compiler would invent structure rather than read it. Send a text PDF, or run OCR over this one first.',
            links: [{ href: '/builder', label: 'Back' }]
          })
        );
      }

      const detectedSets = detectTransactionSets(extracted.pages);
      const sv = detectStandardVersion(extracted.pages);
      const meta = {
        hubName: req.body.hubName?.trim() || '',
        hubSlug: slugify(req.body.hubName),
        title: req.body.title?.trim() || '',
        transactionSet: req.body.transactionSet?.trim() || detectedSets[0]?.code || '',
        standard: req.body.standard?.trim() || sv.standard,
        version: req.body.version?.trim() || sv.version,
        direction: req.body.direction === 'partner_receives' ? 'partner_receives' : 'partner_sends',
        authoredBy: 'OpenText Professional Services on behalf of the hub'
      };
      if (!meta.title && meta.transactionSet) {
        meta.title = `${meta.standard} ${meta.transactionSet} supplier requirements`;
      }

      await query(`UPDATE imports SET status='compiling', pages=$2, page_text=$3, meta=$4, updated_at=now() WHERE id=$1`, [
        importId,
        extracted.totalPages,
        JSON.stringify(extracted.pages),
        JSON.stringify(meta)
      ]);
      await appendLog(
        importId,
        `Extracted ${extracted.totalPages} pages from ${sourceName}. ${meta.standard || 'Standard'} ${meta.version || ''} ${meta.transactionSet || ''}`.replace(/\s+/g, ' ').trim() + '.'
      );

      /* The compile runs on the server; the page shows its progress. */
      startCompile(importId);
      res.redirect(`/builder/i/${importId}`);
    } catch (err) {
      next(err);
    }
  });

  app.get('/builder/i/:id', async (req, res, next) => {
    try {
      if (!(await dbAvailable())) return res.status(503).type('html').send(message({ title: 'Database not connected', lede: 'Reviewing needs the database.', links: [{ href: '/builder', label: 'Back' }] }));
      const imp = await one(`SELECT * FROM imports WHERE id = $1`, [req.params.id]);
      if (!imp) return res.status(404).type('html').send(message({ title: 'Import not found', lede: 'No import with that id.', links: [{ href: '/builder', label: 'Back' }] }));
      if (imp.status !== 'ready') {
        return res.type('html').send(progressScreen(imp));
      }
      const prepared = prepareForReview(imp.spec);
      if (prepared.changed) {
        await query(`UPDATE imports SET spec=$2, updated_at=now() WHERE id=$1`, [imp.id, JSON.stringify(prepared.spec)]);
      }
      const versions = await many(
        `SELECT v.id, v.version, v.attested_at, v.published_at, g.slug AS guide_slug, h.slug AS hub_slug
           FROM guide_versions v JOIN guides g ON g.id = v.guide_id JOIN hubs h ON h.id = g.hub_id
          WHERE v.import_id = $1 ORDER BY v.version DESC`,
        [imp.id]
      );
      res.type('html').send(renderReview({ imp, spec: prepared.spec, versions, baseUrl: baseUrlOf(req) }));
    } catch (err) {
      next(err);
    }
  });

  /** Apply review actions by finding ID. Each edit: { fid, action, fields }. */
  app.post('/builder/i/:id/apply', async (req, res, next) => {
    try {
      const imp = await one(`SELECT * FROM imports WHERE id = $1`, [req.params.id]);
      if (!imp) return res.status(404).json({ ok: false, error: 'not_found' });
      const spec = prepareForReview(imp.spec).spec;
      const now = new Date().toISOString();
      let applied = 0;
      const missing = [];

      for (const edit of req.body?.edits || []) {
        const f = findByFid(spec, edit?.fid);
        if (!f) { missing.push(edit?.fid); continue; }
        const it = f.item;
        it.review = it.review || {};
        const action = edit.action;
        if (action === 'edit') {
          for (const [field, raw] of Object.entries(edit.fields || {})) {
            const value = typeof raw === 'string' ? raw.trim() : raw;
            if (['min', 'max', 'maxUse'].includes(field)) {
              const n = Number.parseInt(value, 10);
              it[field] = Number.isFinite(n) ? n : null;
            } else if (field === 'usage') {
              if (USAGE.includes(value)) it.usage = value;
            } else if (field === 'values') {
              it.values = String(value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
                const m = line.match(/^(\S+)\s*(.*?)(?:\s*\((.*)\))?$/);
                return { code: m[1], description: m[2] || '', note: m[3] || null };
              });
            } else if (['id', 'ref', 'type'].includes(field)) {
              if (value) it[field] = String(value).toUpperCase();
            } else {
              it[field] = value === '' ? null : value;
            }
          }
          it.review.state = 'edited';
          it.review.editedAt = now;
          it.confidence = 'high';
        } else if (action === 'confirm') {
          it.review.state = 'confirmed';
          it.review.confirmedAt = now;
          it.confidence = 'high';
        } else if (action === 'drop') {
          it.review.before = it.review.state || null;
          it.review.state = 'dropped';
          it.review.droppedAt = now;
        } else if (action === 'restore') {
          it.review.state = it.review.editedAt ? 'edited' : (it.review.before || null);
          if (!it.review.state) delete it.review.state;
          delete it.review.droppedAt;
        } else if (REVIEW_STATES.includes(action)) {
          it.review.state = action;
        } else {
          continue;
        }
        applied += 1;
      }

      await query(`UPDATE imports SET spec=$2, updated_at=now() WHERE id=$1`, [imp.id, JSON.stringify(spec)]);
      res.json({ ok: true, applied, missing, summary: findingsSummary(spec) });
    } catch (err) {
      next(err);
    }
  });

  app.post('/builder/i/:id/publish', form, async (req, res, next) => {
    try {
      const imp = await one(`SELECT * FROM imports WHERE id = $1`, [req.params.id]);
      if (!imp) return res.status(404).type('html').send(message({ title: 'Import not found', lede: 'No import with that id.', links: [{ href: '/builder', label: 'Back' }] }));

      const spec = publishableSpec(prepareForReview(imp.spec).spec);
      const hubName = (req.body.hubName || spec.guide?.hub?.name || '').trim();
      const hubSlug = slugify(hubName);
      const transactionSet = (req.body.transactionSet || spec.guide?.transactionSet || '').trim();
      const stdVersion = (req.body.version || spec.guide?.version || '').trim();
      const title = (req.body.title || spec.guide?.title || '').trim();
      const visibility = ['open', 'approval', 'unlisted'].includes(req.body.visibility) ? req.body.visibility : 'open';

      if (!hubName || !transactionSet || !stdVersion || !title) {
        return res.status(400).type('html').send(
          message({ title: 'Missing details', lede: 'Hub name, transaction set, version and title are all needed to publish.', links: [{ href: `/builder/i/${imp.id}`, label: 'Back to review' }] })
        );
      }

      spec.guide = {
        ...spec.guide,
        hub: { ...(spec.guide?.hub || {}), name: hubName, slug: hubSlug },
        title,
        transactionSet,
        version: stdVersion
      };

      let hub = await one(`SELECT * FROM hubs WHERE slug = $1`, [hubSlug]);
      if (!hub) {
        const hubId = newId('hub');
        await query(`INSERT INTO hubs (id, slug, name) VALUES ($1,$2,$3)`, [hubId, hubSlug, hubName]);
        hub = { id: hubId, slug: hubSlug, name: hubName };
      }

      const guideSlug = `${transactionSet.toLowerCase()}-${stdVersion.toLowerCase()}`;
      let guide = await one(`SELECT * FROM guides WHERE hub_id = $1 AND slug = $2`, [hub.id, guideSlug]);
      if (!guide) {
        const guideId = newId('gd');
        await query(
          `INSERT INTO guides (id, hub_id, slug, title, standard, transaction_set, std_version, direction, summary, visibility)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            guideId, hub.id, guideSlug, title,
            spec.guide.standard || 'X12', transactionSet, stdVersion,
            spec.guide.direction || 'partner_sends', spec.guide.summary || '', visibility
          ]
        );
        guide = { id: guideId, slug: guideSlug, hub_id: hub.id };
      } else {
        await query(`UPDATE guides SET title=$2, visibility=$3, summary=$4 WHERE id=$1`, [
          guide.id, title, visibility, spec.guide.summary || ''
        ]);
      }

      const prev = await one(`SELECT max(version) AS v FROM guide_versions WHERE guide_id = $1`, [guide.id]);
      const nextVersion = (prev?.v || 0) + 1;
      const versionId = newId('gv');
      await query(
        `INSERT INTO guide_versions
           (id, guide_id, version, status, spec, source_name, source_pages, compiled_by, changelog, import_id)
         VALUES ($1,$2,$3,'draft',$4,$5,$6,$7,$8,$9)`,
        [
          versionId, guide.id, nextVersion, JSON.stringify(spec),
          imp.source_name, imp.pages, imp.compiled_by,
          (req.body.changelog || '').trim() || null, imp.id
        ]
      );
      /* The draft keeps the guide details the publisher entered, so the next
         review opens with them. */
      const draft = prepareForReview(imp.spec).spec;
      draft.guide = { ...draft.guide, ...spec.guide };
      await query(`UPDATE imports SET hub_id=$2, spec=$3, updated_at=now() WHERE id=$1`, [imp.id, hub.id, JSON.stringify(draft)]);

      res.type('html').send(
        message({
          title: `Version ${nextVersion} created as a draft`,
          lede: `Record the ${hubName} signatory on the attestation page. The version is not published until attested.`,
          links: [
            { href: `/attest/${versionId}`, label: 'Open the attestation page' },
            { href: `/g/${hubSlug}/${guideSlug}/v/${nextVersion}`, label: 'Preview the guide' },
            { href: `/builder/i/${imp.id}`, label: 'Back to review' }
          ]
        })
      );
    } catch (err) {
      next(err);
    }
  });

  /* Attestation publishes a version, so it requires the platform administrator. */
  app.get('/attest/:versionId', async (req, res, next) => {
    try {
      if (!(await dbAvailable())) return res.status(503).type('html').send(message({ title: 'Database not connected', lede: 'Attestation needs the database.', links: [{ href: '/', label: 'Catalogue' }] }));
      const version = await one(`SELECT * FROM guide_versions WHERE id = $1`, [req.params.versionId]);
      if (!version) return res.status(404).type('html').send(message({ title: 'Nothing to attest', lede: 'That attestation link is not valid.', links: [{ href: '/', label: 'Catalogue' }] }));
      const guide = await one(
        `SELECT g.*, h.slug AS hub_slug, h.name AS hub_name FROM guides g JOIN hubs h ON h.id=g.hub_id WHERE g.id = $1`,
        [version.guide_id]
      );
      res.type('html').send(
        attestScreen({ guide, version, baseUrl: baseUrlOf(req), done: Boolean(version.attested_at) })
      );
    } catch (err) {
      next(err);
    }
  });

  app.post('/attest/:versionId', form, async (req, res, next) => {
    try {
      const name = (req.body.name || '').trim();
      const role = (req.body.role || '').trim();
      if (!name || !role || req.body.confirm !== 'yes') {
        return res.status(400).type('html').send(
          message({ title: 'Not signed', lede: 'Name, role and the confirmation are all needed.', links: [{ href: `/attest/${req.params.versionId}`, label: 'Back' }] })
        );
      }
      const version = await one(`SELECT * FROM guide_versions WHERE id = $1`, [req.params.versionId]);
      if (!version) return res.status(404).type('html').send(message({ title: 'Nothing to attest', lede: 'That link is not valid.', links: [{ href: '/', label: 'Catalogue' }] }));
      if (version.attested_at) {
        return res.redirect(`/attest/${version.id}`);
      }

      // Publishing a new version supersedes the previous published one.
      await query(
        `UPDATE guide_versions SET status='superseded'
          WHERE guide_id=$1 AND status='published' AND version <> $2`,
        [version.guide_id, version.version]
      );
      await query(
        `UPDATE guide_versions
            SET attested_by=$2, attested_role=$3, attested_at=now(), published_at=now(), status='published'
          WHERE id=$1`,
        [version.id, name, role]
      );
      res.redirect(`/attest/${version.id}`);
    } catch (err) {
      next(err);
    }
  });
}
