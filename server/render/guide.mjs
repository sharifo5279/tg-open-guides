import { esc, inlineProse, layout, citeTag } from './html.mjs';
import { codeBlock } from '../highlight.mjs';
import { currentAccount } from '../context.mjs';
import {
  DIRECTIONS,
  outline,
  segAnchor,
  maxUseLabel,
  repeatLabel,
  typeLabel,
  specStats,
  usageLabel
} from '../spec.mjs';

/**
 * The guide page is laid out the way EDI implementation guides are read: the
 * transaction set structure is the document. One dense table lists every
 * segment in area and loop order, and each row opens to its element table in
 * place. Rules, envelope, code lists, agent access and version history are
 * tabs beside it, so the structure holds the first screen.
 *
 * Navigation: a sticky structure tree on the left, a position rail on the
 * right that follows the reader through the structure, and deep links to any
 * segment or rule. Without JavaScript every panel and every segment is shown.
 */

function reqLabel(usage) {
  return {
    required: 'Mandatory',
    conditional: 'Conditional',
    optional: 'Optional',
    notUsed: 'Not used'
  }[usage] || usageLabel(usage);
}

function reqCell(usage, short = false) {
  const cls = usage === 'required' ? 'rq rq-m' : usage === 'notUsed' ? 'rq rq-n' : usage === 'conditional' ? 'rq rq-c' : 'rq rq-o';
  const label = short ? { required: 'M', conditional: 'C', optional: 'O', notUsed: 'N/U' }[usage] || reqLabel(usage) : reqLabel(usage);
  return `<span class="${cls}" title="${esc(reqLabel(usage))}">${esc(label)}</span>`;
}

function maxCell(n) {
  if (n == null || n === '') return '';
  const v = Number(n);
  if (!Number.isFinite(v)) return esc(String(n));
  return v === 0 || v >= 100000 ? '&gt;1' : esc(String(v));
}

function repeatCell(n) {
  if (n == null || n === '') return '';
  const v = Number(n);
  if (!Number.isFinite(v)) return esc(String(n));
  return v === 0 || v >= 100000 ? '&gt;1' : esc(String(v));
}

function loopAnchor(lp) {
  return `loop-${String(lp.id).toLowerCase().replace(/[^a-z0-9]+/g, '')}`;
}

/* ------------------------------------------------------------------ sidebar */

function sidebar(areas) {
  const item = (s) =>
    `<li data-seg="${esc(s.id)}"><a href="#${esc(segAnchor(s))}"><span class="t-id">${esc(s.id)}</span><span class="t-nm">${esc(s.name || '')}</span></a></li>`;
  return `<aside class="side">
  <details class="side-in" id="sidedisc" open>
    <summary class="side-sum">Structure</summary>
    <input class="side-filter" type="search" id="navfilter" placeholder="Filter segments" aria-label="Filter segments">
    <nav class="side-nav" aria-label="Structure">
      ${areas.map((area) => `<p class="side-area">${esc(area.label)}</p>
      <ul class="side-list side-tree">
        ${area.rows.map((row) => {
          if (row.type === 'segment') return item(row.segment);
          const lp = row.loop;
          return `<li class="t-loop" data-seg="${esc(lp.segments.map((s) => s.id).join(' '))}">
            <a class="t-loophead" href="#${esc(loopAnchor(lp))}">${esc(lp.id)} loop<span class="t-rep">${repeatCell(lp.repeat) ? `&times;${repeatCell(lp.repeat)}` : ''}</span></a>
            <ul class="side-list t-sub">${lp.segments.map(item).join('')}</ul>
          </li>`;
        }).join('')}
      </ul>`).join('')}
    </nav>
  </details>
</aside>`;
}

/* --------------------------------------------------------------- position rail */

function rail(areas) {
  const ticks = [];
  for (const area of areas) {
    ticks.push(`<a class="rail-area" href="#area-${esc(area.key)}" title="${esc(area.label)}">${esc(area.label[0])}</a>`);
    for (const row of area.rows) {
      const segs = row.type === 'segment' ? [row.segment] : row.loop.segments;
      for (const s of segs) {
        ticks.push(`<a class="rail-tick${row.type === 'loop' ? ' in-loop' : ''}" href="#${esc(segAnchor(s))}" data-for="${esc(segAnchor(s))}" title="${esc(s.id)} ${esc(s.name || '')}"><span>${esc(s.id)}</span></a>`);
      }
    }
  }
  return `<nav class="rail" aria-label="Position in structure">
  <a class="rail-top" href="#top" title="Top of page">&uarr;</a>
  <div class="rail-ticks">${ticks.join('')}</div>
</nav>`;
}

/* ---------------------------------------------------------------- elements */

function codesInline(values) {
  if (!(values || []).length) return '';
  return `<span class="codes">${values.map((v) =>
    `<span class="cd"><code>${esc(v.code)}</code> ${esc(v.description || '')}${v.note ? ` <i class="el-note">(${esc(v.note)})</i>` : ''}</span>`
  ).join('')}</span>`;
}

function elementsTable(seg) {
  if (!(seg.elements || []).length) {
    return '<p class="st-empty">No element detail documented by the hub for this segment.</p>';
  }
  return `<table class="tbl-el">
<thead><tr><th>Ref</th><th>Name</th><th>Type</th><th>Req</th><th>Min</th><th>Max</th><th>Notes and values</th></tr></thead>
<tbody>
${seg.elements.map((el) => `<tr${el.usage === 'notUsed' ? ' class="el-unused"' : ''}>
<td class="mono"><b>${esc(el.ref)}</b>${el.id ? ` <span class="el-dict">${esc(el.id)}</span>` : ''}</td>
<td>${esc(el.name || '')}</td>
<td class="mono">${esc(el.type ? String(el.type).toUpperCase() : '')}</td>
<td>${reqCell(el.usage, true)}</td>
<td class="mono num">${esc(el.min ?? '')}</td>
<td class="mono num">${esc(el.max ?? '')}</td>
<td class="notes">${el.note ? `<span class="el-note">${inlineProse(el.note)}</span> ` : ''}${codesInline(el.values)}${citeTag(el.citation)}</td>
</tr>`).join('\n')}
</tbody></table>`;
}

/* --------------------------------------------------------------- structure */

function segmentRows(seg, inLoop) {
  const anchor = segAnchor(seg);
  const n = (seg.elements || []).length;
  return `<tr class="st-seg${inLoop ? ' st-in' : ''}" id="${esc(anchor)}" data-seg="${esc(seg.id)}">
<td class="mono pos">${esc(seg.pos || '')}</td>
<td class="mono seg"><button class="st-tog" type="button" aria-expanded="false" aria-controls="${esc(anchor)}-d"><span class="chev"></span>${esc(seg.id)}</button></td>
<td class="name">${esc(seg.name || '')}</td>
<td>${reqCell(seg.usage)}</td>
<td class="mono num">${maxCell(seg.maxUse)}</td>
<td class="mono num">${n || ''}</td>
<td class="cite-c">${citeTag(seg.citation)}<a class="seg-link" href="#${esc(anchor)}" title="Link to this segment">#</a></td>
</tr>
<tr class="st-det" id="${esc(anchor)}-d" hidden><td colspan="7"><div class="st-det-in${inLoop ? ' st-in' : ''}">${seg.note ? `<p class="st-segnote">${inlineProse(seg.note)}</p>` : ''}${elementsTable(seg)}</div></td></tr>`;
}

function structureTable(areas) {
  const rows = [];
  for (const area of areas) {
    rows.push(`<tr class="st-area" id="area-${esc(area.key)}"><td colspan="7">${esc(area.label)}<span class="st-count">${area.count} segment${area.count === 1 ? '' : 's'}</span></td></tr>`);
    for (const row of area.rows) {
      if (row.type === 'segment') {
        rows.push(segmentRows(row.segment, false));
        continue;
      }
      const lp = row.loop;
      rows.push(`<tr class="st-loop" id="${esc(loopAnchor(lp))}">
<td class="mono pos"></td>
<td class="mono seg">${esc(lp.id)}</td>
<td class="name"><b>${esc(lp.id)} loop</b>${lp.name && lp.name !== lp.id ? ` <span class="el-note">${esc(lp.name)}</span>` : ''}${lp.note ? `<span class="st-note">${inlineProse(lp.note)}</span>` : ''}</td>
<td>${reqCell(lp.usage)}</td>
<td class="mono num" title="Loop repeat">${repeatCell(lp.repeat) ? `&times;${repeatCell(lp.repeat)}` : ''}</td>
<td></td>
<td class="cite-c">${citeTag(lp.citation)}</td>
</tr>`);
      for (const s of lp.segments) rows.push(segmentRows(s, true));
    }
  }
  return `<table class="tbl-st" id="sttable">
<thead><tr><th>Pos</th><th>Segment</th><th>Name</th><th>Requirement</th><th title="Max use, or loop repeat">Max</th><th title="Documented elements">Elem</th><th></th></tr></thead>
<tbody>${rows.join('\n')}</tbody></table>`;
}

/* ---------------------------------------------------------------- panels */

function rulesTable(rules) {
  if (!rules.length) return '<p class="rc-note">No hub rules were documented beyond the structure.</p>';
  return `<table class="tbl-dense tbl-rules">
<thead><tr><th>ID</th><th>Applies to</th><th>Rule</th><th>Source</th></tr></thead>
<tbody>${rules.map((r) => `<tr id="rule-${esc(r.id)}">
<td class="mono"><b>${esc(r.id)}</b></td>
<td class="mono">${esc(r.appliesTo || '')}</td>
<td>${inlineProse(r.statement)}${r.rationale ? `<span class="st-note">${inlineProse(r.rationale)}</span>` : ''}</td>
<td class="cite-c">${citeTag(r.citation)}</td>
</tr>`).join('\n')}</tbody></table>`;
}

function envelopeTable(rows, label, id) {
  if (!rows?.length) return '';
  return `<h3 id="${esc(id)}">${esc(label)}</h3>
<table class="tbl-dense">
<thead><tr><th>Element</th><th>Name</th><th>Req</th><th>Value</th><th>Notes</th></tr></thead>
<tbody>
${rows.map((r) => `<tr>
<td class="mono"><b>${esc(r.ref)}</b></td>
<td>${esc(r.name || '')}</td>
<td>${reqCell(r.usage, true)}</td>
<td class="mono">${r.value ? `<code>${esc(r.value)}</code>` : ''}</td>
<td class="notes">${r.note ? `<span class="el-note">${inlineProse(r.note)}</span> ` : ''}${citeTag(r.citation)}</td>
</tr>`).join('\n')}
</tbody></table>`;
}

/* ------------------------------------------------------------- version diff */

const FIELD_LABEL = { pos: 'position', name: 'name', usage: 'requirement', type: 'type', min: 'min', max: 'max', maxUse: 'max use', loopId: 'loop', note: 'note', value: 'required value', statement: 'rule', appliesTo: 'applies to', rationale: 'rationale', description: 'description', requirement: 'requirement', values: 'accepted values' };

function diffLabel(f) {
  const it = f.item;
  const ref = f.kind === 'element' ? `${f.parent?.id || ''} ${it.ref}`.trim() : f.ref;
  const name = it.name || it.statement || it.requirement || '';
  return `<span class="mono">${esc(ref)}</span> ${esc(String(name).slice(0, 90))}`;
}

function withdrawForm(v) {
  if (v.status === 'withdrawn') {
    return `<form method="post" action="/builder/withdraw/${esc(v.id)}" class="inline-form"><input type="hidden" name="action" value="reinstate"><button class="btn-link" type="submit">Reinstate</button></form>`;
  }
  return `<form method="post" action="/builder/withdraw/${esc(v.id)}" class="inline-form" data-confirm="Withdraw version ${esc(v.version)}? It stays readable at its own address."><button class="btn-link warn" type="submit">Withdraw</button></form>`;
}

function diffBlock(diff, prevV, curV) {
  const n = diff.added.length + diff.removed.length + diff.changed.length;
  if (!n) return `<p class="section-sub">No requirement changes from version ${esc(prevV)}.</p>`;
  const rows = [
    ...diff.added.map((f) => `<tr><td class="dk dk-add">Added</td><td>${diffLabel(f)}</td><td class="el-note"></td></tr>`),
    ...diff.removed.map((f) => `<tr><td class="dk dk-rm">Removed</td><td>${diffLabel(f)}</td><td class="el-note"></td></tr>`),
    ...diff.changed.map((f) => `<tr><td class="dk dk-ch">Changed</td><td>${diffLabel(f)}</td><td class="el-note">${f.fields.map((x) => esc(FIELD_LABEL[x] || x)).join(', ')}</td></tr>`)
  ];
  return `<h3>Changes from version ${esc(prevV)}</h3>
<p class="section-sub">${diff.added.length} added, ${diff.removed.length} removed, ${diff.changed.length} changed.</p>
<table class="tbl-dense tbl-diff"><thead><tr><th>Change</th><th>Finding</th><th>Fields</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

/* -------------------------------------------------------------------- page */

export function renderGuidePage({
  spec,
  guide,
  version,
  versions = [],
  diff = null,
  previousVersion = null,
  baseUrl = '',
  guidePath = '',
}) {
  const g = spec.guide || {};
  const admin = Boolean(currentAccount()?.is_platform_admin);
  const stats = specStats(spec);
  const areas = outline(spec);
  const rules = spec.rules || [];
  const codeLists = Object.entries(spec.codeLists || {});
  const scenarios = spec.scenarios || [];
  const mdUrl = `${guidePath}/md`;
  const jsonUrl = `${guidePath}/json`;
  const mcpConfig = JSON.stringify(
    { mcpServers: { 'tg-open-guides': { type: 'http', url: `${baseUrl}/mcp` } } },
    null,
    2
  );

  const withdrawn = version?.status === 'withdrawn'
    ? `<li class="att-no"><b>Withdrawn.</b> This version is no longer current. Use the latest published version.</li>` : '';
  const attested = version?.attested_by
    ? `<li class="att-ok"><b>Attested</b> by ${esc(version.attested_by)}${version.attested_role ? `, ${esc(version.attested_role)}` : ''}, ${esc(new Date(version.attested_at).toISOString().slice(0, 10))}</li>`
    : `<li class="att-no"><b>Not attested.</b> Compiled from ${esc(version?.source_name || 'a source guide')}, not signed by ${esc(g.hub?.name)}. Do not build against it.</li>`;

  const tabs = [
    ['structure', 'Structure', stats.segments],
    ['rules', 'Rules', rules.length],
    ['envelope', 'Envelope', null],
    ...(codeLists.length ? [['codes', 'Code lists', codeLists.length]] : []),
    ...(scenarios.length ? [['scenarios', 'Scenarios', scenarios.length]] : []),
    ['agents', 'Agent access', null],
    ['about', 'Versions', versions.length || null]
  ];

  const body = `
<div class="crumbs" id="top"><div class="wide">
  <a href="/">Hubs</a> <span>/</span> <a href="/h/${esc(guide.hub_slug)}">${esc(g.hub?.name || '')}</a> <span>/</span>
  <b>${esc(g.standard)} ${esc(g.transactionSet)} ${esc(g.version)}</b>
</div></div>

<div class="guidehead"><div class="wide ghead">
  <div class="ghead-main">
    <h1>${esc(g.transactionSet)}${g.title && g.title !== g.transactionSet ? ` <span class="h1-sub">${esc(g.title)}</span>` : ''}</h1>
    <ul class="specline">
      <li><b>${esc(g.hub?.name || '')}</b></li>
      <li>${esc(g.standard)} ${esc(g.version)}</li>
      <li>${esc(DIRECTIONS[g.direction] || g.direction)}</li>
      ${g.effectiveFrom ? `<li>Effective ${esc(g.effectiveFrom)}</li>` : ''}
      <li>Guide v${esc(version?.version ?? '-')}</li>
      ${attested}
      ${withdrawn}
    </ul>
    ${g.summary ? `<p class="lede">${inlineProse(g.summary)}</p>` : ''}
  </div>
  <div class="copyrow ghead-aside">
    <a class="btn btn-outline" href="${esc(mdUrl)}">Markdown</a>
    <a class="btn btn-outline" href="${esc(jsonUrl)}">JSON</a>
    <button class="btn btn-quiet" type="button" data-copy-pre="mcp-config">Copy MCP config</button>
    ${admin && version?.import_id ? `<a class="btn btn-quiet" href="/builder/i/${esc(version.import_id)}">Edit in Guide Builder</a>` : ''}
  </div>
</div></div>

<div class="tabbar"><div class="wide tabbar-in">
  <nav class="tabs" role="tablist" aria-label="Guide sections">
    ${tabs.map(([id, label, n], i) => `<a class="tab${i === 0 ? ' on' : ''}" role="tab" href="#${id}" data-tab="${id}" aria-selected="${i === 0}">${esc(label)}${n != null ? `<span class="tab-n">${esc(n)}</span>` : ''}</a>`).join('')}
  </nav>
  <div class="tabtools" data-tools="structure">
    <button class="btn-link" type="button" id="expand-all">Expand all</button>
    <button class="btn-link" type="button" id="collapse-all">Collapse all</button>
  </div>
</div></div>

<div class="guidebody"><div class="wide wide-split">
${sidebar(areas)}
<div class="doc">

  <section class="panel on" id="structure" role="tabpanel">
    <p class="panel-sub">${stats.segments} segments, ${stats.requiredSegments} mandatory. ${stats.elements} documented elements, ${stats.requiredElements} mandatory. Open a segment for its elements.</p>
    ${structureTable(areas)}
  </section>

  <section class="panel" id="rules" role="tabpanel">
    <p class="panel-sub">Stated by ${esc(g.hub?.name)} in its own words, each cited to a source page.</p>
    ${rulesTable(rules)}
  </section>

  <section class="panel" id="envelope" role="tabpanel">
    <p class="panel-sub">Delimiters: segment <code>${esc(spec.delimiters?.segment)}</code>, element <code>${esc(spec.delimiters?.element)}</code>, component <code>${esc(spec.delimiters?.component)}</code>, repetition <code>${esc(spec.delimiters?.repetition)}</code>.</p>
    ${envelopeTable(spec.envelope?.isa, 'ISA interchange', 'env-isa')}
    ${envelopeTable(spec.envelope?.gs, 'GS functional group', 'env-gs')}
    ${envelopeTable(spec.envelope?.st, 'ST transaction set', 'env-st')}
  </section>

  ${codeLists.length ? `<section class="panel" id="codes" role="tabpanel">
    <p class="panel-sub">Only these values are accepted. Codes valid in ${esc(g.standard)} but absent here are rejected.</p>
    ${codeLists.map(([ref, codes]) => `<h3 class="mono">${esc(ref)}</h3>
    <table class="tbl-dense">
    <thead><tr><th>Code</th><th>Description</th><th>Note</th></tr></thead>
    <tbody>${codes.map((c) => `<tr><td class="mono"><b>${esc(c.code)}</b></td><td>${esc(c.description || '')}</td><td class="el-note">${esc(c.note || '')}</td></tr>`).join('')}</tbody>
    </table>`).join('\n')}
  </section>` : ''}

  ${scenarios.length ? `<section class="panel" id="scenarios" role="tabpanel">
    <p class="panel-sub">Cases ${esc(g.hub?.name)} expects a partner to support before cutover.</p>
    <table class="tbl-dense">
    <thead><tr><th>ID</th><th>Scenario</th><th>Requirement</th><th>Source</th></tr></thead>
    <tbody>${scenarios.map((s) => `<tr><td class="mono"><b>${esc(s.id)}</b></td><td><b>${esc(s.name)}</b>${s.description ? `<span class="st-note">${inlineProse(s.description)}</span>` : ''}</td><td>${inlineProse(s.requirement || '')}</td><td class="cite-c">${citeTag(s.citation)}</td></tr>`).join('')}</tbody>
    </table>
  </section>` : ''}

  <section class="panel" id="agents" role="tabpanel">
    <p class="panel-sub">This guide is served as JSON, Markdown and MCP from the version rendered here.</p>
    <div class="agentbox">
      <p class="rc-note" style="margin-bottom:8px">Markdown is returned to any client that requests it:</p>
      ${codeBlock(`curl -H "Accept: text/markdown" ${baseUrl}${guidePath}`, 'bash')}
      <p style="margin:14px 0 6px"><b>MCP configuration, all hubs:</b></p>
      ${codeBlock(mcpConfig, 'json', { id: 'mcp-config' })}
      <p class="rc-note" style="margin:0">Endpoints provide integration requirements. File validation and hub certification are not supported.</p>
    </div>
  </section>

  <section class="panel" id="about" role="tabpanel">
    ${diff ? diffBlock(diff, previousVersion, version?.version) : ''}
    <div class="twocol">
      <div>
        <h3>Version history</h3>
        <p class="section-sub">Published versions remain accessible and unchanged.</p>
        <ul class="verlist">
          ${versions.length ? versions.map((v) => `<li>
<span class="ver ${v.version === version?.version ? 'v-cur' : ''}"><a href="${esc(guidePath)}/v/${esc(v.version)}">v${esc(v.version)}</a></span>
<span>${v.status === 'withdrawn' ? 'withdrawn' : v.published_at ? esc(new Date(v.published_at).toISOString().slice(0, 10)) : 'draft'}</span>
<span class="rc-note">${esc(v.changelog || '')}</span>
${admin && v.id && v.status !== 'draft' ? withdrawForm(v) : ''}
</li>`).join('\n') : '<li><span class="rc-note">This is the first version.</span></li>'}
        </ul>
        ${admin && version?.id && !version.import_id ? `<form method="post" action="/builder/revise/${esc(version.id)}" class="inline-form" style="margin-top:10px"><button class="btn btn-outline" type="submit">Revise in Guide Builder</button></form>` : ''}
      </div>
      <div class="tint">
        <h3>Source</h3>
        <dl class="kv">
          ${g.authoredBy ? `<dt>Authored by</dt><dd>${esc(g.authoredBy)}</dd>` : ''}
          ${version?.source_name ? `<dt>Compiled from</dt><dd>${esc(version.source_name)}${version.source_pages ? `, ${esc(version.source_pages)} pages` : ''}</dd>` : ''}
          ${g.supersedes ? `<dt>Supersedes</dt><dd>${esc(g.supersedes)}</dd>` : ''}
          <dt>Citation coverage</dt><dd>${Math.round(stats.citedFraction * 100)}% of items cite a source page</dd>
        </dl>
        ${(spec.contacts || []).length ? `<h3 style="margin-top:18px">Contacts</h3>
        <dl class="kv">${spec.contacts.map((c) => `<dt>${esc(c.role || c.name)}</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}${c.note ? `<br>${esc(c.note)}` : ''}</dd>`).join('')}</dl>` : ''}
      </div>
    </div>
  </section>

</div>
${rail(areas)}
</div></div>

<script>
document.documentElement.classList.add('js');
document.addEventListener('submit', function (e) {
  var f = e.target.closest('form[data-confirm]');
  if (f && !confirm(f.getAttribute('data-confirm'))) e.preventDefault();
});

document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-copy],[data-copy-pre]');
  if (!btn) return;
  var text = btn.getAttribute('data-copy');
  if (!text) { var pre = document.getElementById(btn.getAttribute('data-copy-pre')); text = pre ? pre.innerText : ''; }
  if (!text || !navigator.clipboard) return;
  navigator.clipboard.writeText(text).then(function () {
    var was = btn.textContent; btn.textContent = 'Copied';
    setTimeout(function () { btn.textContent = was; }, 1400);
  });
});

/* Tabs. The panel ids double as hashes, and a hash that names a segment or a
   rule opens the panel that holds it. */
(function () {
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab[data-tab]'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('.panel'));
  var tools = document.querySelector('.tabtools');
  var body = document.body;
  function show(id) {
    panels.forEach(function (p) { p.classList.toggle('on', p.id === id); });
    tabs.forEach(function (t) { var on = t.getAttribute('data-tab') === id; t.classList.toggle('on', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); });
    if (tools) tools.hidden = tools.getAttribute('data-tools') !== id;
    body.classList.toggle('on-structure', id === 'structure');
  }
  function open(hash) {
    var id = (hash || '').replace(/^#/, '');
    if (!id) return show('structure');
    var el = document.getElementById(id);
    if (!el) return;
    var panel = el.closest ? el.closest('.panel') : null;
    if (panel) show(panel.id); else return;
    if (el !== panel) {
      if (el.classList.contains('st-seg')) expand(el, true);
      setTimeout(function () { el.scrollIntoView({ block: 'start' }); }, 0);
    }
  }
  window.addEventListener('hashchange', function () { open(location.hash); });
  open(location.hash);

  /* Segment rows open to their element table. */
  function expand(row, on) {
    var btn = row.querySelector('.st-tog');
    var det = document.getElementById(row.id + '-d');
    if (!btn || !det) return;
    det.hidden = !on;
    btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    row.classList.toggle('open', on);
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.st-tog');
    if (!btn) return;
    var row = btn.closest('tr');
    expand(row, btn.getAttribute('aria-expanded') !== 'true');
  });
  var rows = Array.prototype.slice.call(document.querySelectorAll('tr.st-seg'));
  var ea = document.getElementById('expand-all'), ca = document.getElementById('collapse-all');
  if (ea) ea.addEventListener('click', function () { rows.forEach(function (r) { expand(r, true); }); });
  if (ca) ca.addEventListener('click', function () { rows.forEach(function (r) { expand(r, false); }); });
})();

/* Filter the structure tree and the structure table together. */
(function () {
  var input = document.getElementById('navfilter');
  if (!input) return;
  var navItems = Array.prototype.slice.call(document.querySelectorAll('.side-tree [data-seg]'));
  var rows = Array.prototype.slice.call(document.querySelectorAll('tr.st-seg'));
  input.addEventListener('input', function () {
    var q = input.value.trim().toUpperCase();
    navItems.forEach(function (li) {
      var ids = (li.getAttribute('data-seg') || '').toUpperCase();
      var txt = (li.textContent || '').toUpperCase();
      li.style.display = !q || ids.indexOf(q) !== -1 || txt.indexOf(q) !== -1 ? '' : 'none';
    });
    rows.forEach(function (r) {
      var id = (r.getAttribute('data-seg') || '').toUpperCase();
      var txt = (r.textContent || '').toUpperCase();
      var hit = !q || id.indexOf(q) !== -1 || txt.indexOf(q) !== -1;
      r.style.display = hit ? '' : 'none';
      var det = document.getElementById(r.id + '-d');
      if (det && !hit) det.hidden = true;
    });
  });
})();

/* On a narrow screen the tree starts collapsed. */
(function () {
  var d = document.getElementById('sidedisc');
  if (!d) return;
  var narrow = window.matchMedia('(max-width: 1100px)');
  var sync = function () { d.open = !narrow.matches; };
  sync();
  if (narrow.addEventListener) narrow.addEventListener('change', sync);
})();

/* Follow the reader through the structure: the tree and the rail mark the
   segment nearest the top of the viewport. */
(function () {
  var rows = Array.prototype.slice.call(document.querySelectorAll('tr.st-seg'));
  if (!rows.length) return;
  var treeLinks = {}, railTicks = {};
  Array.prototype.forEach.call(document.querySelectorAll('.side-tree a[href^="#s-"]'), function (a) { treeLinks[a.getAttribute('href').slice(1)] = a; });
  Array.prototype.forEach.call(document.querySelectorAll('.rail-tick'), function (a) { railTicks[a.getAttribute('data-for')] = a; });
  var current = null;
  function mark() {
    var line = 120, best = null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].style.display === 'none') continue;
      var top = rows[i].getBoundingClientRect().top;
      if (top <= line) best = rows[i]; else break;
    }
    if (!best) best = rows[0];
    if (best === current) return;
    if (current) {
      if (treeLinks[current.id]) treeLinks[current.id].classList.remove('cur');
      if (railTicks[current.id]) railTicks[current.id].classList.remove('cur');
    }
    current = best;
    if (treeLinks[best.id]) {
      treeLinks[best.id].classList.add('cur');
      var side = document.querySelector('.side');
      if (side) {
        var r = treeLinks[best.id].getBoundingClientRect(), s = side.getBoundingClientRect();
        if (r.top < s.top + 40 || r.bottom > s.bottom - 40) treeLinks[best.id].scrollIntoView({ block: 'center' });
      }
    }
    if (railTicks[best.id]) railTicks[best.id].classList.add('cur');
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { mark(); ticking = false; });
  }, { passive: true });
  mark();
})();
</script>`;

  return layout({
    title: `${g.standard} ${g.transactionSet} | ${g.hub?.name} | Trading Grid Open Guides`,
    description: `${g.hub?.name} requirements for ${g.standard} ${g.transactionSet} ${g.version}. Hub-attested, versioned, readable by people and agents.`,
    canonical: baseUrl + guidePath,
    bodyClass: 'is-guide on-structure',
    body
  });
}
