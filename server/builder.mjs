/**
 * Guide Builder: import, review, publish, attest.
 *
 * The review screen is the product. A 60-page guide compiles to a few hundred items,
 * and a reviewer who is asked to confirm all of them abandons the task. So the screen
 * leads with what the compiler could not find, then the items it is unsure about, and
 * collapses what it is confident about behind a count.
 *
 * Attestation is deliberately a separate, linkable page with no account behind it. In
 * the motion that matters, OpenText Professional Services authors the guide and the
 * hub signs it, and the hub should not need a builder login to put their name on
 * their own requirements.
 */
import express from 'express';
import multer from 'multer';
import { esc, layout, citeTag } from './render/html.mjs';
import { extractPages, detectTransactionSets, detectStandardVersion } from './extract.mjs';
import { compileGuide, triage } from './compile.mjs';
import { validateSpec, specStats, DIRECTIONS, USAGE } from './spec.mjs';
import { modelAvailable, modelName } from './model.mjs';
import { query, one, many } from './db.mjs';
import { dbAvailable, newId } from './store.mjs';

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
  <thead><tr><th>Source</th><th>Hub</th><th>Status</th><th>Compiled by</th><th>Pages</th><th></th></tr></thead>
  <tbody>${imports.map((i) => `<tr>
    <td>${esc(i.source_name)}</td>
    <td>${esc(i.hub_name || '-')}</td>
    <td>${esc(i.status)}${i.error ? ` <span class="rc-note">${esc(String(i.error).slice(0, 80))}</span>` : ''}</td>
    <td class="mono">${esc(i.compiled_by || '-')}</td>
    <td class="mono">${esc(i.pages ?? '-')}</td>
    <td>${i.status === 'ready' ? `<a href="/builder/i/${esc(i.id)}">Review</a>` : ''}</td>
  </tr>`).join('')}</tbody></table></div>
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

function reviewItemRow(entry, idx) {
  const it = entry.item;
  const path = `${entry.kind}:${idx}`;
  if (entry.kind === 'rule') {
    return `<div class="rv" data-path="${esc(path)}">
  <div class="rv-head">
    <span class="rv-kind">Rule</span><span class="rule-id">${esc(it.id)}</span>${citeTag(it.citation)}
    <label class="rv-drop"><input type="checkbox" data-drop> Drop</label>
  </div>
  <textarea data-field="statement" rows="2">${esc(it.statement)}</textarea>
  <div class="rv-row">
    <label>Applies to <input data-field="appliesTo" value="${esc(it.appliesTo || '')}"></label>
  </div>
  <textarea data-field="rationale" rows="1" placeholder="Why the hub enforces this, if the guide says">${esc(it.rationale || '')}</textarea>
</div>`;
  }
  if (entry.kind === 'element') {
    return `<div class="rv" data-path="${esc(path)}">
  <div class="rv-head">
    <span class="rv-kind">Element</span><span class="mono">${esc(entry.ref)}</span>${citeTag(it.citation)}
    <label class="rv-drop"><input type="checkbox" data-drop> Drop</label>
  </div>
  <div class="rv-row">
    <label>Name <input data-field="name" value="${esc(it.name || '')}"></label>
    <label>Usage
      <select data-field="usage">${USAGE.map((u) => `<option value="${u}" ${it.usage === u ? 'selected' : ''}>${u}</option>`).join('')}</select>
    </label>
    <label>Type <input data-field="type" value="${esc(it.type || '')}"></label>
    <label>Min <input data-field="min" value="${esc(it.min ?? '')}" inputmode="numeric"></label>
    <label>Max <input data-field="max" value="${esc(it.max ?? '')}" inputmode="numeric"></label>
  </div>
  <textarea data-field="note" rows="1" placeholder="Hub note">${esc(it.note || '')}</textarea>
</div>`;
  }
  if (entry.kind === 'envelope') {
    return `<div class="rv" data-path="${esc(path)}">
  <div class="rv-head"><span class="rv-kind">Envelope</span><span class="mono">${esc(it.ref)}</span>${citeTag(it.citation)}
    <label class="rv-drop"><input type="checkbox" data-drop> Drop</label></div>
  <div class="rv-row">
    <label>Name <input data-field="name" value="${esc(it.name || '')}"></label>
    <label>Usage <select data-field="usage">${USAGE.map((u) => `<option value="${u}" ${it.usage === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
    <label>Required value <input data-field="value" value="${esc(it.value || '')}"></label>
  </div>
  <textarea data-field="note" rows="1" placeholder="Note">${esc(it.note || '')}</textarea>
</div>`;
  }
  if (entry.kind === 'scenario') {
    return `<div class="rv" data-path="${esc(path)}">
  <div class="rv-head"><span class="rv-kind">Scenario</span><span class="mono">${esc(it.id || '')}</span>${citeTag(it.citation)}
    <label class="rv-drop"><input type="checkbox" data-drop> Drop</label></div>
  <div class="rv-row"><label>Name <input data-field="name" value="${esc(it.name || '')}"></label></div>
  <textarea data-field="requirement" rows="2" placeholder="What the partner must prove">${esc(it.requirement || '')}</textarea>
</div>`;
  }
  return `<div class="rv" data-path="${esc(path)}">
  <div class="rv-head"><span class="rv-kind">Segment</span><span class="mono">${esc(entry.ref)}</span>${citeTag(it.citation)}
    <label class="rv-drop"><input type="checkbox" data-drop> Drop</label></div>
  <div class="rv-row">
    <label>Name <input data-field="name" value="${esc(it.name || '')}"></label>
    <label>Usage <select data-field="usage">${USAGE.map((u) => `<option value="${u}" ${it.usage === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
    <label>Loop <input data-field="loopId" value="${esc(it.loopId || '')}"></label>
    <label>Max use <input data-field="maxUse" value="${esc(it.maxUse ?? '')}" inputmode="numeric"></label>
  </div>
  <textarea data-field="note" rows="1" placeholder="Hub note">${esc(it.note || '')}</textarea>
</div>`;
}

function reviewScreen({ imp, spec, baseUrl }) {
  const t = triage(spec);
  const stats = specStats(spec);
  const check = validateSpec(spec);
  const g = spec.guide || {};

  const body = `
<div class="phead"><div class="shell">
  <p class="eyebrow">Guide Builder &middot; review</p>
  <h1>${esc(g.title || imp.source_name)}</h1>
  <p class="lede">Compiled from ${esc(imp.source_name)}${imp.pages ? `, ${esc(imp.pages)} pages` : ''} by <code>${esc(t.compiledBy)}</code>. ${t.needsReview.length} of ${t.needsReview.length + t.confirmed.length} items need review.</p>
  <ul class="specline">
    <li>${esc(g.standard)} ${esc(g.version || '?')}</li>
    <li>Set <b>${esc(g.transactionSet || '?')}</b></li>
    <li>${esc(DIRECTIONS[g.direction] || g.direction)}</li>
    <li><b>${stats.segments}</b> segments</li>
    <li><b>${stats.elements}</b> elements</li>
    <li><b>${stats.rules}</b> rules</li>
  </ul>
</div></div>

${t.note ? `<section class="section"><div class="shell"><div class="notice">${esc(t.note)}</div></div></section>` : ''}

<section class="section"><div class="shell">
  <h2>Gaps</h2>
  <p class="section-sub">A gap here is usually a gap in the source document, which means partners have been guessing about it.</p>
  ${t.gaps.length
    ? `<ul class="inline-list">${t.gaps.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
    : '<p class="rc-note">Nothing obvious missing.</p>'}
  ${check.errors.length ? `<h3 style="margin-top:18px">Blocking errors</h3><ul class="inline-list">${check.errors.slice(0, 20).map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
</div></section>

<section class="section"><div class="shell">
  <h2>Needs review (${t.needsReview.length})</h2>
  <p class="section-sub">Items the compiler was unsure about or could not attribute to a page. Correct them, or drop what is not a requirement.</p>
  <form id="reviewform">
    ${t.needsReview.length ? t.needsReview.map((e, i) => reviewItemRow(e, i)).join('\n') : '<p class="rc-note">Nothing uncertain. Unusual, so spot-check the confirmed list below.</p>'}
  </form>
  <div class="copyrow">
    <button class="btn" type="button" id="save">Save corrections</button>
    <span id="savemsg" class="rc-note"></span>
  </div>
</div></section>

<section class="section"><div class="shell">
  <details>
    <summary><b>Confirmed (${t.confirmed.length})</b>, stated on a cited page</summary>
    <div class="tbl-wrap" style="margin-top:12px"><table class="tbl">
      <thead><tr><th>Kind</th><th>Ref</th><th>Detail</th><th>Page</th></tr></thead>
      <tbody>${t.confirmed.slice(0, 400).map((e) => `<tr>
        <td>${esc(e.kind)}</td>
        <td class="mono">${esc(e.ref || '')}</td>
        <td>${esc(String(e.item.name || e.item.statement || e.item.requirement || '').slice(0, 120))}</td>
        <td class="mono">${esc(e.item.citation?.page ?? '')}</td>
      </tr>`).join('')}</tbody></table></div>
  </details>
</div></section>

<section class="section"><div class="shell"><div class="twocol">
  <div>
    <h2>Publish</h2>
    <p class="section-sub">Publishing creates an unattested draft and a link to send the hub for signature. Nothing is public until it is attested and set to public.</p>
    <form method="post" action="/builder/i/${esc(imp.id)}/publish" class="form">
      <div class="formrow">
        <label>Hub name <input name="hubName" value="${esc(g.hub?.name || imp.hub_name || '')}" required></label>
        <label>Transaction set <input name="transactionSet" value="${esc(g.transactionSet || '')}" required></label>
        <label>Version <input name="version" value="${esc(g.version || '')}" required></label>
      </div>
      <label>Guide title <input name="title" value="${esc(g.title || '')}" required></label>
      <label>Visibility
        <select name="visibility">
          <option value="unlisted">Unlisted: anyone with the link, not in the catalogue</option>
          <option value="public">Public: listed in the catalogue</option>
          <option value="community">Community: hub's partners only</option>
        </select>
      </label>
      <label>Changelog <input name="changelog" placeholder="First structured publication, compiled from the v4.2 PDF"></label>
      <button class="btn" type="submit">Publish draft</button>
    </form>
  </div>
  <div class="tint">
    <h3>Visibility</h3>
    <p class="rc-note">An unlisted guide is served to anyone with the link, including agents, but is not listed publicly. Most hubs start here.</p>
    <h3 style="margin-top:16px">Citation coverage</h3>
    <p class="rc-note">${Math.round(stats.citedFraction * 100)}% of items cite a source page.</p>
  </div>
</div></div></section>

<style>
.rv { border:1px solid var(--line); border-radius:12px; padding:12px 14px; margin-bottom:10px; }
.rv-head { display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap; }
.rv-kind { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--slate); }
.rv-drop { margin-left:auto; font-size:12px; color:var(--slate); display:flex; align-items:center; gap:5px; }
.rv-row { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:8px; }
.rv-row label { font-size:12px; font-weight:600; color:var(--slate); flex:1 1 130px; }
.rv input, .rv select, .rv textarea { display:block; width:100%; margin-top:3px; font:400 14px/1.4 var(--sans); color:var(--ink); padding:6px 9px; border:1px solid var(--line); border-radius:6px; background:#fff; }
.rv textarea { margin-bottom:8px; resize:vertical; }
.rv input:focus, .rv select:focus, .rv textarea:focus { outline:2px solid var(--primary); outline-offset:-1px; }
.rv.dropped { opacity:.45; }
details summary { cursor:pointer; font-size:15px; }
.form label { display:block; font-size:14px; font-weight:600; color:var(--ink); margin-bottom:12px; }
.form input, .form select { display:block; width:100%; margin-top:4px; font:400 15px/1.4 var(--sans); color:var(--ink); padding:9px 12px; border:1px solid var(--line); border-radius:8px; background:#fff; }
.formrow { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
@media (max-width:640px){ .formrow { grid-template-columns:1fr; } }
</style>
<script>
document.addEventListener('change', function (e) {
  if (e.target.matches('[data-drop]')) {
    e.target.closest('.rv').classList.toggle('dropped', e.target.checked);
  }
});
document.getElementById('save').addEventListener('click', async function () {
  var edits = [];
  document.querySelectorAll('.rv').forEach(function (box) {
    var fields = {};
    box.querySelectorAll('[data-field]').forEach(function (f) { fields[f.getAttribute('data-field')] = f.value; });
    edits.push({ path: box.getAttribute('data-path'), drop: !!box.querySelector('[data-drop]:checked'), fields: fields });
  });
  var msg = document.getElementById('savemsg');
  msg.textContent = 'Saving...';
  try {
    var r = await fetch(location.pathname + '/apply', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ edits: edits })
    });
    var j = await r.json();
    msg.textContent = j.ok ? ('Saved. ' + j.applied + ' items updated, ' + j.dropped + ' dropped.') : ('Failed: ' + (j.error || 'unknown'));
    if (j.ok) setTimeout(function () { location.reload(); }, 900);
  } catch (err) { msg.textContent = 'Failed: ' + err.message; }
});
</script>`;

  return layout({ title: `Review ${esc(imp.source_name)} | Guide Builder`, body, canonical: `${baseUrl}/builder/i/${imp.id}` });
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

function message({ title, lede, links = [] }) {
  return layout({
    title: `${title} | Trading Grid Open Guides`,
    body: `<div class="phead"><div class="shell"><h1>${esc(title)}</h1><p class="lede">${esc(lede)}</p>
<div class="copyrow">${links.map((l) => `<a class="btn btn-outline" href="${esc(l.href)}">${esc(l.label)}</a>`).join('')}</div></div></div>`
  });
}

/* ------------------------------------------------------------------- routes */

export function mountBuilder(app, { baseUrlOf }) {
  app.get('/builder', async (req, res, next) => {
    try {
      const dbUp = await dbAvailable();
      let imports = [];
      if (dbUp) {
        imports = await many(
          `SELECT i.*, h.name AS hub_name FROM imports i
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

      await query(`UPDATE imports SET status='compiling', pages=$2, page_text=$3, updated_at=now() WHERE id=$1`, [
        importId,
        extracted.totalPages,
        JSON.stringify(extracted.pages)
      ]);

      const spec = await compileGuide(extracted.pages, meta);
      await query(
        `UPDATE imports SET status='ready', spec=$2, compiled_by=$3, updated_at=now() WHERE id=$1`,
        [importId, JSON.stringify(spec), spec.compileReport?.compiledBy || 'unknown']
      );

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
        return res.type('html').send(
          message({ title: `Import is ${imp.status}`, lede: imp.error || 'Still working. Reload in a moment.', links: [{ href: '/builder', label: 'Back' }] })
        );
      }
      res.type('html').send(reviewScreen({ imp, spec: imp.spec, baseUrl: baseUrlOf(req) }));
    } catch (err) {
      next(err);
    }
  });

  /** Apply reviewer corrections against the same triage order the screen rendered. */
  app.post('/builder/i/:id/apply', async (req, res, next) => {
    try {
      const imp = await one(`SELECT * FROM imports WHERE id = $1`, [req.params.id]);
      if (!imp) return res.status(404).json({ ok: false, error: 'not_found' });
      const spec = imp.spec;
      const order = triage(spec).needsReview;
      let applied = 0;
      const toDrop = [];

      for (const edit of req.body?.edits || []) {
        const [, idxRaw] = String(edit.path || '').split(':');
        const idx = Number.parseInt(idxRaw, 10);
        const entry = order[idx];
        if (!entry) continue;
        if (edit.drop) {
          toDrop.push(entry);
          continue;
        }
        const it = entry.item;
        for (const [field, value] of Object.entries(edit.fields || {})) {
          if (['min', 'max', 'maxUse'].includes(field)) {
            const n = Number.parseInt(value, 10);
            it[field] = Number.isFinite(n) ? n : null;
          } else if (field === 'usage') {
            it.usage = USAGE.includes(value) ? value : it.usage;
          } else {
            it[field] = value === '' ? null : value;
          }
        }
        // A human looked at it, so it is no longer the compiler's uncertainty.
        it.confidence = 'high';
        it.reviewed = true;
        applied += 1;
      }

      for (const entry of toDrop) {
        if (entry.kind === 'rule') {
          spec.rules = spec.rules.filter((r) => r !== entry.item);
        } else if (entry.kind === 'scenario') {
          spec.scenarios = spec.scenarios.filter((s) => s !== entry.item);
        } else if (entry.kind === 'envelope') {
          spec.envelope[entry.group] = spec.envelope[entry.group].filter((r) => r !== entry.item);
        } else if (entry.kind === 'element') {
          entry.parent.elements = entry.parent.elements.filter((e) => e !== entry.item);
        } else if (entry.kind === 'segment') {
          spec.segments = spec.segments.filter((s) => s !== entry.item);
        }
      }

      await query(`UPDATE imports SET spec=$2, updated_at=now() WHERE id=$1`, [imp.id, JSON.stringify(spec)]);
      res.json({ ok: true, applied, dropped: toDrop.length });
    } catch (err) {
      next(err);
    }
  });

  app.post('/builder/i/:id/publish', form, async (req, res, next) => {
    try {
      const imp = await one(`SELECT * FROM imports WHERE id = $1`, [req.params.id]);
      if (!imp) return res.status(404).type('html').send(message({ title: 'Import not found', lede: 'No import with that id.', links: [{ href: '/builder', label: 'Back' }] }));

      const spec = imp.spec;
      const hubName = (req.body.hubName || spec.guide?.hub?.name || '').trim();
      const hubSlug = slugify(hubName);
      const transactionSet = (req.body.transactionSet || spec.guide?.transactionSet || '').trim();
      const stdVersion = (req.body.version || spec.guide?.version || '').trim();
      const title = (req.body.title || spec.guide?.title || '').trim();
      const visibility = ['public', 'unlisted', 'community'].includes(req.body.visibility) ? req.body.visibility : 'unlisted';

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
           (id, guide_id, version, status, spec, source_name, source_pages, compiled_by, changelog)
         VALUES ($1,$2,$3,'draft',$4,$5,$6,$7,$8)`,
        [
          versionId, guide.id, nextVersion, JSON.stringify(spec),
          imp.source_name, imp.pages, imp.compiled_by,
          (req.body.changelog || '').trim() || null
        ]
      );
      await query(`UPDATE imports SET hub_id=$2, updated_at=now() WHERE id=$1`, [imp.id, hub.id]);

      const base = baseUrlOf(req);
      res.type('html').send(
        message({
          title: `Version ${nextVersion} created as a draft`,
          lede: `Send this link to ${hubName} for signature: ${base}/attest/${versionId} . Nothing is published until they attest it.`,
          links: [
            { href: `/attest/${versionId}`, label: 'Open the attestation page' },
            { href: `/g/${hubSlug}/${guideSlug}/v/${nextVersion}`, label: 'Preview the guide' },
            { href: '/builder', label: 'Builder' }
          ]
        })
      );
    } catch (err) {
      next(err);
    }
  });

  /* Standalone attestation: a link the hub can open with no account. */
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
