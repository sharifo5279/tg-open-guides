import { esc, inlineProse, layout, severityPill, citeTag } from './html.mjs';
import {
  DIRECTIONS,
  outline,
  loopInfo,
  segAnchor,
  maxUseLabel,
  repeatLabel,
  typeLabel,
  specStats,
  usageLabel
} from '../spec.mjs';

/**
 * The guide page is a reference document, so it is built like one: a persistent
 * structure tree on the left, an index of the whole transaction set before the
 * detail, and element tables in the column order EDI people already read
 * (position, element, name, type, requirement, min, max, repeat).
 *
 * What it does differently from a standards reference: it opens with what the hub
 * requires and what the hub rejects, because a supplier's developer asks those two
 * questions before they ask about segment order. The reference follows underneath.
 */

function reqLabel(usage) {
  return {
    required: 'Mandatory',
    conditional: 'Conditional',
    optional: 'Optional',
    notUsed: 'Not used'
  }[usage] || usageLabel(usage);
}

/** Wrap cell content so a stacked cell has a single grid child beside its label. */
function cell(inner) {
  return `<span class="cw">${inner}</span>`;
}

function reqCell(usage) {
  const cls = usage === 'required' ? 'rq rq-m' : usage === 'notUsed' ? 'rq rq-n' : usage === 'conditional' ? 'rq rq-c' : 'rq rq-o';
  return `<span class="${cls}">${esc(reqLabel(usage))}</span>`;
}

/* ------------------------------------------------------------------ sidebar */

function sidebar(spec, areas) {
  const sections = [
    ['requirements', 'What you must send'],
    ['rejects', 'What gets you rejected'],
    ['agents', 'For your agent'],
    ['scenarios', 'Scenarios'],
    ['envelope', 'Envelope'],
    ['structure', 'Structure index'],
    ['reference', 'Segment reference'],
    ['codes', 'Code lists'],
    ['about', 'Versions and provenance']
  ];
  return `<aside class="side">
  <details class="side-in" id="sidedisc" open>
    <summary class="side-sum">Contents and structure</summary>
    <input class="side-filter" type="search" id="navfilter" placeholder="Filter segments" aria-label="Filter segments">
    <nav class="side-nav" aria-label="On this page">
      <p class="side-h">On this page</p>
      <ul class="side-list">
        ${sections.map(([id, label]) => `<li><a href="#${id}">${esc(label)}</a></li>`).join('')}
      </ul>
      <p class="side-h">Structure</p>
      ${areas.map((area) => `<p class="side-area">${esc(area.label)}</p>
      <ul class="side-list side-tree">
        ${area.rows.map((row) => {
          if (row.type === 'segment') {
            return `<li data-seg="${esc(row.segment.id)}"><a href="#${esc(segAnchor(row.segment))}"><span class="t-id">${esc(row.segment.id)}</span><span class="t-nm">${esc(row.segment.name || '')}</span></a></li>`;
          }
          const lp = row.loop;
          return `<li class="t-loop" data-seg="${esc(lp.segments.map((s) => s.id).join(' '))}">
            <span class="t-loophead">${esc(lp.id)}<span class="t-rep">${esc(repeatLabel(lp.repeat))}</span></span>
            <ul class="side-list t-sub">
              ${lp.segments.map((s) => `<li data-seg="${esc(s.id)}"><a href="#${esc(segAnchor(s))}"><span class="t-id">${esc(s.id)}</span><span class="t-nm">${esc(s.name || '')}</span></a></li>`).join('')}
            </ul>
          </li>`;
        }).join('')}
      </ul>`).join('')}
    </nav>
  </details>
</aside>`;
}

/* ------------------------------------------------- structure index (Stedi-like) */

function structureIndex(spec, areas) {
  const rows = [];
  for (const area of areas) {
    rows.push(`<tr class="ix-area"><td colspan="5">${esc(area.label)}</td></tr>`);
    for (const row of area.rows) {
      if (row.type === 'segment') {
        const s = row.segment;
        rows.push(`<tr>
<td class="mono" data-c="pos">${esc(s.pos || '')}</td>
<td class="mono" data-c="seg"><a href="#${esc(segAnchor(s))}">${esc(s.id)}</a></td>
<td data-c="name">${esc(s.name || '')}</td>
<td data-c="req">${reqCell(s.usage)}</td>
<td class="mono ix-max" data-c="max">${esc(maxUseLabel(s.maxUse))}</td>
</tr>`);
        continue;
      }
      const lp = row.loop;
      rows.push(`<tr class="ix-loop">
<td data-c="pos"></td>
<td class="mono" colspan="2" data-c="name"><b>${esc(lp.id)} Loop</b> <span class="el-note">${esc(lp.name)}</span></td>
<td data-c="req">${reqCell(lp.usage)}</td>
<td class="mono ix-max" data-c="max">${esc(repeatLabel(lp.repeat))}</td>
</tr>`);
      for (const s of lp.segments) {
        rows.push(`<tr class="ix-in">
<td class="mono" data-c="pos">${esc(s.pos || '')}</td>
<td class="mono" data-c="seg"><a href="#${esc(segAnchor(s))}">${esc(s.id)}</a></td>
<td data-c="name">${esc(s.name || '')}</td>
<td data-c="req">${reqCell(s.usage)}</td>
<td class="mono ix-max" data-c="max">${esc(maxUseLabel(s.maxUse))}</td>
</tr>`);
      }
    }
  }
  return `<div class="tbl-wrap"><table class="tbl tbl-ix">
<thead><tr><th>Position</th><th>Segment</th><th>Name</th><th>Requirement</th><th>Max use</th></tr></thead>
<tbody>${rows.join('\n')}</tbody></table></div>`;
}

/* ------------------------------------------------------------ element tables */

function elementsTable(seg) {
  if (!(seg.elements || []).length) {
    return '<p class="rc-note">This segment carries no elements the hub has documented.</p>';
  }
  return `<div class="tbl-wrap"><table class="tbl tbl-el">
<thead><tr><th>Position</th><th>Element</th><th>Name</th><th>Type</th><th>Requirement</th><th>Min</th><th>Max</th><th>Notes and values</th></tr></thead>
<tbody>
${seg.elements.map((el) => {
    const pos = String(el.ref).match(/(\d{2})$/)?.[1] ?? '';
    const codes = (el.values || []).length
      ? `<ul class="codelist">${el.values.map((v) => `<li><code>${esc(v.code)}</code><span class="cv">${esc(v.description || '')}${v.note ? `<span class="el-note">${esc(v.note)}</span>` : ''}</span></li>`).join('')}</ul>`
      : '';
    const note = el.note ? `<div class="el-note">${inlineProse(el.note)}</div>` : '';
    return `<tr${el.usage === 'notUsed' ? ' class="el-unused"' : ''}>
<td class="mono" data-l="Position">${cell(esc(pos))}</td>
<td class="mono" data-l="Element">${cell(`<b>${esc(el.ref)}</b>${el.id ? `<span class="el-dict">${esc(el.id)}</span>` : ''}`)}</td>
<td data-l="Name">${cell(esc(el.name || ''))}</td>
<td class="mono nowrap" data-l="Type">${cell(esc(typeLabel(el.type)))}</td>
<td data-l="Requirement">${cell(reqCell(el.usage))}</td>
<td class="mono" data-l="Min">${cell(esc(el.min ?? ''))}</td>
<td class="mono" data-l="Max">${cell(esc(el.max ?? ''))}</td>
<td data-l="Notes">${cell(`${note}${codes}${citeTag(el.citation)}`)}</td>
</tr>`;
  }).join('\n')}
</tbody></table></div>`;
}

function segmentBlock(seg, guidePath) {
  const anchor = segAnchor(seg);
  return `<article class="seg" id="${esc(anchor)}" data-seg="${esc(seg.id)}">
  <header class="seg-head">
    <h4 class="seg-title"><span class="seg-id">${esc(seg.id)}</span> ${esc(seg.name || '')}</h4>
    <div class="seg-facts">
      ${reqCell(seg.usage)}
      <span class="seg-fact">Position ${esc(seg.pos || '-')}</span>
      ${seg.maxUse ? `<span class="seg-fact">${esc(maxUseLabel(seg.maxUse))}</span>` : ''}
      ${seg.loopId ? `<span class="seg-fact">Loop ${esc(seg.loopId)}</span>` : ''}
      ${citeTag(seg.citation)}
      <a class="seg-link" href="#${esc(anchor)}" title="Link to this segment">#</a>
    </div>
  </header>
  ${seg.note ? `<p class="seg-note">${inlineProse(seg.note)}</p>` : ''}
  ${elementsTable(seg)}
</article>`;
}

function envelopeTable(rows, label, id) {
  if (!rows?.length) return '';
  return `<h3 id="${esc(id)}">${esc(label)}</h3>
<div class="tbl-wrap"><table class="tbl tbl-stack">
<thead><tr><th>Element</th><th>Name</th><th>Requirement</th><th>Required value</th><th>Notes</th></tr></thead>
<tbody>
${rows.map((r) => `<tr>
<td class="mono" data-l="Element">${cell(`<b>${esc(r.ref)}</b>`)}</td>
<td data-l="Name">${cell(esc(r.name || ''))}</td>
<td data-l="Requirement">${cell(reqCell(r.usage))}</td>
<td class="mono" data-l="Required value">${cell(r.value ? `<code>${esc(r.value)}</code>` : '')}</td>
<td data-l="Notes">${cell(`${r.note ? `<span class="el-note">${inlineProse(r.note)}</span> ` : ''}${citeTag(r.citation)}`)}</td>
</tr>`).join('\n')}
</tbody></table></div>`;
}

/* ------------------------------------------------------------- lead sections */

function requiredSummary(spec) {
  const seen = new Set();
  const cards = [];
  for (const seg of (spec.segments || []).filter((s) => s.usage === 'required')) {
    const key = `${seg.id}:${seg.loopId || seg.level}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const reqEls = (seg.elements || []).filter((e) => e.usage === 'required').map((e) => e.ref);
    cards.push(`<li class="reqcard">
<a class="rc-seg" href="#${esc(segAnchor(seg))}">${esc(seg.id)}</a>${seg.loopId ? `<span class="rc-loop">${esc(seg.loopId)}</span>` : ''}
<div class="rc-name">${esc(seg.name || '')}</div>
<p class="rc-note">${reqEls.length ? reqEls.map((r) => `<code>${esc(r)}</code>`).join(' ') : 'No mandatory elements beyond the segment itself.'}</p>
</li>`);
  }
  return cards.join('\n');
}

function ruleItem(rule) {
  const cls = rule.severity === 'reject' ? 'rule rule-reject' : rule.severity === 'warn' ? 'rule rule-warn' : 'rule';
  return `<li class="${cls}" id="rule-${esc(rule.id)}">
<div class="rule-head">${severityPill(rule.severity)}<span class="rule-id">${esc(rule.id)}</span>${rule.appliesTo ? `<span class="rule-applies">${esc(rule.appliesTo)}</span>` : ''}${citeTag(rule.citation)}</div>
<p class="rule-stmt">${inlineProse(rule.statement)}</p>
${rule.rationale ? `<p class="rule-why">${inlineProse(rule.rationale)}</p>` : ''}
</li>`;
}

/* -------------------------------------------------------------------- page */

export function renderGuidePage({
  spec,
  guide,
  version,
  versions = [],
  baseUrl = '',
  guidePath = '',
}) {
  const g = spec.guide || {};
  const stats = specStats(spec);
  const areas = outline(spec);
  const rejects = (spec.rules || []).filter((r) => r.severity === 'reject');
  const others = (spec.rules || []).filter((r) => r.severity !== 'reject');
  const mdUrl = `${guidePath}.md`;
  const jsonUrl = `${guidePath}.json`;
  const mcpConfig = JSON.stringify(
    { mcpServers: { 'tg-open-guides': { type: 'http', url: `${baseUrl}/mcp` } } },
    null,
    2
  );

  const attested = version?.attested_by
    ? `<div class="attested">
<span class="att-label">Attested by ${esc(version.attested_by)}${version.attested_role ? `, ${esc(version.attested_role)}` : ''} at ${esc(g.hub?.name)}</span>
<span class="att-meta">on ${esc(new Date(version.attested_at).toISOString().slice(0, 10))}, as the requirements in force for version ${esc(version.version)}.</span>
</div>`
    : `<div class="attested unattested">
<span class="att-label">Not attested.</span>
<span class="att-meta">Compiled from ${esc(version?.source_name || 'a source guide')}, not yet signed by ${esc(g.hub?.name)}. Do not build against it.</span>
</div>`;

  const body = `
<div class="crumbs"><div class="wide">
  <a href="/">Hubs</a> <span>/</span> <a href="/h/${esc(guide.hub_slug)}">${esc(g.hub?.name || '')}</a> <span>/</span>
  <b>${esc(g.standard)} ${esc(g.transactionSet)} ${esc(g.version)}</b>
</div></div>

<div class="guidehead"><div class="wide">
  <h1>${esc(g.title)}</h1>
  <ul class="specline">
    <li><b>${esc(g.hub?.name || '')}</b></li>
    <li>${esc(g.standard)} ${esc(g.version)}, set <b>${esc(g.transactionSet)}</b></li>
    <li>${esc(DIRECTIONS[g.direction] || g.direction)}</li>
    ${g.effectiveFrom ? `<li>Effective <b>${esc(g.effectiveFrom)}</b></li>` : ''}
    <li>Guide <b>v${esc(version?.version ?? '-')}</b></li>
  </ul>
  ${g.summary ? `<p class="lede">${inlineProse(g.summary)}</p>` : ''}
  ${attested}
  <div class="copyrow">
    <a class="btn btn-outline" href="${esc(mdUrl)}">Markdown</a>
    <a class="btn btn-outline" href="${esc(jsonUrl)}">JSON</a>
    <button class="btn btn-quiet" type="button" data-copy-pre="mcp-config">Copy MCP config</button>
  </div>
</div></div>

<div class="guidebody"><div class="wide wide-split">
${sidebar(spec, areas)}
<div class="doc">

  <section class="dsec" id="requirements">
    <h2>Required segments</h2>
    <p class="section-sub">${stats.requiredSegments} mandatory segments, ${stats.requiredElements} mandatory elements, ${stats.rejectRules} rejection rules.</p>
    <ul class="reqgrid">${requiredSummary(spec)}</ul>
  </section>

  <section class="dsec" id="rejects">
    <h2>Rejection rules</h2>
    <p class="section-sub">Enforced by ${esc(g.hub?.name)}. A transaction breaking any of these is refused.</p>
    <ul class="rules">${rejects.map(ruleItem).join('\n')}</ul>
    ${others.length ? `<h3>Other rules</h3><ul class="rules">${others.map(ruleItem).join('\n')}</ul>` : ''}
  </section>

  <section class="dsec" id="agents">
    <div class="agentbox">
      <h3>Agent access</h3>
      <p>This guide is served as JSON, Markdown and MCP from the version rendered here.</p>
      <p class="rc-note">Markdown is returned to any client that requests it: <code>curl -H "Accept: text/markdown" ${esc(baseUrl + guidePath)}</code></p>
      <p style="margin:14px 0 6px"><b>MCP configuration, all hubs:</b></p>
      <pre id="mcp-config"><code>${esc(mcpConfig)}</code></pre>
      <p class="rc-note" style="margin:0">Endpoints provide integration requirements. File validation and hub certification are not supported.</p>
    </div>
  </section>

  ${(spec.scenarios || []).length ? `<section class="dsec" id="scenarios">
    <h2>Test scenarios</h2>
    <p class="section-sub">Cases ${esc(g.hub?.name)} expects a partner to support before cutover.</p>
    ${spec.scenarios.map((s) => `<div class="scenario">
<h4>${esc(s.id)} &middot; ${esc(s.name)}</h4>
${s.description ? `<p class="rc-note">${inlineProse(s.description)}</p>` : ''}
${s.requirement ? `<p class="sc-req"><b>Requirement:</b> ${inlineProse(s.requirement)}</p>` : ''}
</div>`).join('\n')}
  </section>` : ''}

  <section class="dsec" id="envelope">
    <h2>Envelope and delimiters</h2>
    <p class="section-sub">Segment <code>${esc(spec.delimiters?.segment)}</code>, element <code>${esc(spec.delimiters?.element)}</code>, component <code>${esc(spec.delimiters?.component)}</code>, repetition <code>${esc(spec.delimiters?.repetition)}</code>.</p>
    ${envelopeTable(spec.envelope?.isa, 'ISA interchange', 'env-isa')}
    ${envelopeTable(spec.envelope?.gs, 'GS functional group', 'env-gs')}
    ${envelopeTable(spec.envelope?.st, 'ST transaction set', 'env-st')}
  </section>

  <section class="dsec" id="structure">
    <h2>Structure index</h2>
    <p class="section-sub">Full transaction set in ${esc(g.standard)} area order, with loop repeat limits.</p>
    ${structureIndex(spec, areas)}
  </section>

  <section class="dsec" id="reference">
    <h2>Segment reference</h2>
    <p class="section-sub">${stats.segments} segments, ${stats.elements} elements. Each row cites its source document page.</p>
    ${areas.map((area) => `<div class="areablock" id="area-${esc(area.key)}">
      <h3 class="area-h">${esc(area.label)}</h3>
      ${area.rows.map((row) => {
        if (row.type === 'segment') return segmentBlock(row.segment, guidePath);
        const lp = row.loop;
        return `<div class="loopblock" id="loop-${esc(lp.id.toLowerCase().replace(/[^a-z0-9]+/g, ''))}">
          <div class="loop-h">
            <span class="loop-id">${esc(lp.id)} Loop</span>
            <span class="loop-name">${esc(lp.name)}</span>
            ${reqCell(lp.usage)}
            <span class="seg-fact">${esc(repeatLabel(lp.repeat))}</span>
            ${lp.parent ? `<span class="seg-fact">in ${esc(lp.parent)}</span>` : ''}
            ${citeTag(lp.citation)}
          </div>
          ${lp.note ? `<p class="loop-note">${inlineProse(lp.note)}</p>` : ''}
          ${lp.segments.map((s) => segmentBlock(s, guidePath)).join('\n')}
        </div>`;
      }).join('\n')}
    </div>`).join('\n')}
  </section>

  ${Object.keys(spec.codeLists || {}).length ? `<section class="dsec" id="codes">
    <h2>Code lists</h2>
    <p class="section-sub">Only these values are accepted. Codes valid in ${esc(g.standard)} but absent here are rejected.</p>
    ${Object.entries(spec.codeLists).map(([ref, codes]) => `<div class="cl">
      <h4 class="cl-h mono">${esc(ref)}</h4>
      <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Code</th><th>Description</th><th>Note</th></tr></thead>
      <tbody>${codes.map((c) => `<tr><td class="mono"><b>${esc(c.code)}</b></td><td>${esc(c.description || '')}</td><td class="el-note">${esc(c.note || '')}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>`).join('\n')}
  </section>` : ''}

  <section class="dsec" id="about">
    <h2>Version history</h2>
    <div class="twocol">
      <div>
        <p class="section-sub">Published versions remain accessible and unchanged.</p>
        <ul class="verlist">
          ${versions.length ? versions.map((v) => `<li>
<span class="ver ${v.version === version?.version ? 'v-cur' : ''}">v${esc(v.version)}</span>
<span>${v.published_at ? esc(new Date(v.published_at).toISOString().slice(0, 10)) : 'draft'}</span>
<span class="rc-note">${esc(v.changelog || '')}</span>
</li>`).join('\n') : '<li><span class="rc-note">This is the first version.</span></li>'}
        </ul>
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
</div></div>

<script>
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

/* Filter the structure tree and the segment reference together, so a developer
   hunting for MAN gets the nav and the document narrowed at once. */
(function () {
  var input = document.getElementById('navfilter');
  if (!input) return;
  var navItems = Array.prototype.slice.call(document.querySelectorAll('.side-tree [data-seg]'));
  var segs = Array.prototype.slice.call(document.querySelectorAll('.doc .seg[data-seg]'));
  input.addEventListener('input', function () {
    var q = input.value.trim().toUpperCase();
    navItems.forEach(function (li) {
      var ids = (li.getAttribute('data-seg') || '').toUpperCase();
      var txt = (li.textContent || '').toUpperCase();
      li.style.display = !q || ids.indexOf(q) !== -1 || txt.indexOf(q) !== -1 ? '' : 'none';
    });
    segs.forEach(function (a) {
      var id = (a.getAttribute('data-seg') || '').toUpperCase();
      var txt = (a.textContent || '').toUpperCase();
      a.style.display = !q || id.indexOf(q) !== -1 || txt.indexOf(q) !== -1 ? '' : 'none';
    });
  });
})();

/* On a narrow screen the structure tree would push the document off the first
   three screenfuls, so it starts collapsed there and open on a wide one. */
(function () {
  var d = document.getElementById('sidedisc');
  if (!d) return;
  var narrow = window.matchMedia('(max-width: 1100px)');
  var sync = function () { d.open = !narrow.matches; };
  sync();
  if (narrow.addEventListener) narrow.addEventListener('change', sync);
})();

/* Mark the section the reader is in. */
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll('.side-list a[href^="#"]'));
  var targets = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  if (!('IntersectionObserver' in window)) return;
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var i = targets.indexOf(en.target);
      if (i === -1) return;
      links.forEach(function (l) { l.classList.remove('cur'); });
      links[i].classList.add('cur');
    });
  }, { rootMargin: '-70px 0px -75% 0px' });
  targets.forEach(function (t) { if (t) obs.observe(t); });
})();
</script>`;

  return layout({
    title: `${g.standard} ${g.transactionSet} | ${g.hub?.name} | Trading Grid Open Guides`,
    description: `${g.hub?.name} requirements for ${g.standard} ${g.transactionSet} ${g.version}. Hub-attested, versioned, readable by people and agents.`,
    canonical: baseUrl + guidePath,
    bodyClass: 'is-guide',
    body
  });
}
