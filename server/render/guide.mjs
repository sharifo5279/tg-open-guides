import { esc, inlineProse, layout, severityPill, usageTag, citeTag } from './html.mjs';
import { DIRECTIONS, segmentsByLoop, specStats, usageLabel } from '../spec.mjs';

function loopHeading(group) {
  if (!group.loopId) {
    const lvl = group.level || 'body';
    return { title: lvl[0].toUpperCase() + lvl.slice(1), id: null };
  }
  const names = {
    'HL-S': 'Shipment level',
    'HL-S/N1': 'Shipment level, names',
    'HL-O': 'Order level',
    'HL-P': 'Pack level',
    'HL-I': 'Item level'
  };
  return { title: names[group.loopId] || `Loop ${group.loopId}`, id: group.loopId };
}

function envelopeTable(rows, label) {
  if (!rows?.length) return '';
  return `<h3>${esc(label)}</h3>
<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>Element</th><th>Name</th><th>Usage</th><th>Value or note</th></tr></thead>
<tbody>
${rows.map((r) => `<tr>
<td class="mono">${esc(r.ref)}</td>
<td>${esc(r.name || '')}</td>
<td>${usageTag(r.usage)}</td>
<td>${r.value ? `<span class="mono">${esc(r.value)}</span> ` : ''}${r.note ? `<span class="el-note">${inlineProse(r.note)}</span> ` : ''}${citeTag(r.citation)}</td>
</tr>`).join('\n')}
</tbody></table></div>`;
}

function elementsTable(seg) {
  if (!(seg.elements || []).length) return '';
  return `<div class="tbl-wrap"><table class="tbl">
<thead><tr><th>Ref</th><th>Name</th><th>Type</th><th>Len</th><th>Usage</th><th>Values</th><th>Note</th></tr></thead>
<tbody>
${seg.elements.map((el) => {
    const codes = (el.values || [])
      .map((v) => `<b>${esc(v.code)}</b>${v.description ? ` ${esc(v.description)}` : ''}${v.note ? ` <span class="el-note">(${esc(v.note)})</span>` : ''}`)
      .join('<br>');
    return `<tr>
<td class="mono">${esc(el.ref)}</td>
<td>${esc(el.name || '')}</td>
<td class="mono">${esc(el.type || '')}</td>
<td class="mono">${el.min ?? ''}${el.max != null ? `/${el.max}` : ''}</td>
<td>${usageTag(el.usage)}</td>
<td class="codes">${codes}</td>
<td class="el-note">${el.note ? inlineProse(el.note) : ''} ${citeTag(el.citation)}</td>
</tr>`;
  }).join('\n')}
</tbody></table></div>`;
}

/** The short answer to "what do I actually have to send". */
function requiredSummary(spec) {
  const required = (spec.segments || []).filter((s) => s.usage === 'required');
  const seen = new Set();
  const cards = [];
  for (const seg of required) {
    const key = `${seg.id}:${seg.loopId || seg.level}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const reqEls = (seg.elements || []).filter((e) => e.usage === 'required').map((e) => e.ref);
    cards.push(`<li class="reqcard">
<div class="rc-seg">${esc(seg.id)}${seg.loopId ? ` <span class="el-note">in ${esc(seg.loopId)}</span>` : ''}</div>
<div class="rc-name">${esc(seg.name || '')}</div>
<p class="rc-note">${reqEls.length ? `Required elements: ${reqEls.map((r) => `<code>${esc(r)}</code>`).join(', ')}` : 'No mandatory elements beyond the segment itself.'}</p>
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

export function renderGuidePage({
  spec,
  guide,
  version,
  versions = [],
  baseUrl = '',
  guidePath = '',
  readCount = null
}) {
  const g = spec.guide || {};
  const stats = specStats(spec);
  const rejects = (spec.rules || []).filter((r) => r.severity === 'reject');
  const others = (spec.rules || []).filter((r) => r.severity !== 'reject');
  const jsonUrl = `${guidePath}.json`;
  const mdUrl = `${guidePath}.md`;
  const mcpUrl = `${baseUrl}/mcp`;

  const mcpConfig = JSON.stringify(
    { mcpServers: { 'tg-open-guides': { type: 'http', url: mcpUrl } } },
    null,
    2
  );

  const attested = version?.attested_by
    ? `<div class="attested">
<span class="att-label">Attested by ${esc(version.attested_by)}${version.attested_role ? `, ${esc(version.attested_role)}` : ''} at ${esc(g.hub?.name)}</span>
<span class="att-meta">on ${esc(new Date(version.attested_at).toISOString().slice(0, 10))}, as the requirements in force for version ${esc(version.version)}.</span>
</div>`
    : `<div class="attested unattested">
<span class="att-label">Not yet attested.</span>
<span class="att-meta">This version is a draft compiled from ${esc(version?.source_name || 'a source guide')} and has not been signed off by ${esc(g.hub?.name)}. Do not build against it.</span>
</div>`;

  const body = `
<div class="phead"><div class="shell">
  <p class="eyebrow">${esc(g.hub?.name || '')}</p>
  <h1>${esc(g.title)}</h1>
  ${g.summary ? `<p class="lede">${inlineProse(g.summary)}</p>` : ''}
  <ul class="specline">
    <li><b>${esc(g.standard)} ${esc(g.version)}</b></li>
    <li>Transaction set <b>${esc(g.transactionSet)}</b></li>
    <li>${esc(DIRECTIONS[g.direction] || g.direction)}</li>
    ${g.effectiveFrom ? `<li>Effective from <b>${esc(g.effectiveFrom)}</b></li>` : ''}
    <li>Version <b>${esc(version?.version ?? '-')}</b></li>
  </ul>
  ${attested}
</div></div>

<section class="section"><div class="shell">
  <h2>What you must send</h2>
  <p class="section-sub">${stats.requiredSegments} required segments, ${stats.requiredElements} required elements, ${stats.rejectRules} rules that cause a rejection. Full reference is further down this page.</p>
  <ul class="reqgrid">${requiredSummary(spec)}</ul>
</div></section>

<section class="section"><div class="shell">
  <h2>What will get you rejected</h2>
  <p class="section-sub">${esc(g.hub?.name)} enforces these. Read this section before you write any code: most of what breaks a first submission is here rather than in the segment tables.</p>
  <ul class="rules">${rejects.map(ruleItem).join('\n')}</ul>
  ${others.length ? `<h3 style="margin-top:22px">Also worth knowing</h3><ul class="rules">${others.map(ruleItem).join('\n')}</ul>` : ''}
</div></section>

<section class="section"><div class="shell">
  <div class="agentbox">
    <h3>Point your agent at this guide</h3>
    <p style="margin-bottom:0">This guide is published as structured data, so an agent can read ${esc(g.hub?.name)}'s actual requirements rather than guess from the ${esc(g.standard)} standard. It publishes requirements only: nothing here validates or certifies a file you have built.</p>
    <div class="copyrow">
      <a class="btn btn-outline" href="${esc(mdUrl)}">Markdown</a>
      <a class="btn btn-outline" href="${esc(guidePath)}/samples">Sample files</a>
      <a class="btn btn-outline" href="${esc(jsonUrl)}">JSON</a>
      <button class="btn btn-quiet" type="button" data-copy="${esc(baseUrl + mdUrl)}">Copy Markdown URL</button>
      <button class="btn btn-quiet" type="button" data-copy-pre="mcp-config">Copy MCP config</button>
    </div>
    <p style="margin:16px 0 6px"><b>Or connect once and reach every guide in the catalogue:</b></p>
    <pre id="mcp-config"><code>${esc(mcpConfig)}</code></pre>
    <p class="rc-note" style="margin:0">Tools exposed: <code>search_guides</code>, <code>get_guide_summary</code>, <code>get_segment</code>, <code>get_rules</code>, <code>get_code_list</code>, <code>get_guide_markdown</code>.</p>
  </div>
</div></section>

${(spec.scenarios || []).length ? `<section class="section"><div class="shell">
  <h2>Scenarios ${esc(g.hub?.name)} expects you to handle</h2>
  <p class="section-sub">A build that passes the first scenario and fails the rest will not survive certification. These are the cases the hub has seen go wrong.</p>
  ${spec.scenarios.map((s) => `<div class="scenario">
<h4>${esc(s.id)} &middot; ${esc(s.name)}</h4>
${s.description ? `<p class="rc-note">${inlineProse(s.description)}</p>` : ''}
${s.requirement ? `<p class="sc-req"><b>Requirement:</b> ${inlineProse(s.requirement)}</p>` : ''}
</div>`).join('\n')}
</div></section>` : ''}

<section class="section"><div class="shell">
  <h2>Envelope and delimiters</h2>
  <p class="section-sub">Delimiters: segment <code>${esc(spec.delimiters?.segment)}</code>, element <code>${esc(spec.delimiters?.element)}</code>, component <code>${esc(spec.delimiters?.component)}</code>, repetition <code>${esc(spec.delimiters?.repetition)}</code>.</p>
  ${envelopeTable(spec.envelope?.isa, 'ISA interchange')}
  ${envelopeTable(spec.envelope?.gs, 'GS functional group')}
  ${envelopeTable(spec.envelope?.st, 'ST transaction set')}
</div></section>

<section class="section"><div class="shell">
  <h2>Segment reference</h2>
  <p class="section-sub">${stats.segments} segments. Every entry cites the page of the source guide it was compiled from, so you can check it against the hub's own document.</p>
  ${segmentsByLoop(spec).map((group) => {
    const h = loopHeading(group);
    return `<div class="loopgroup">
<h3>${esc(h.title)}${h.id ? `<span class="loop-id">${esc(h.id)}</span>` : ''}</h3>
${group.segments.map((seg) => `<div class="seg" id="seg-${esc(seg.id)}-${esc(seg.pos)}">
  <div class="seg-head">
    <span class="seg-id">${esc(seg.id)}</span>
    <span class="seg-name">${esc(seg.name || '')}</span>
    ${usageTag(seg.usage)}
    <span class="seg-meta">pos ${esc(seg.pos || '-')}${seg.maxUse ? `, max use ${esc(seg.maxUse)}` : ''}</span>
    ${citeTag(seg.citation)}
  </div>
  ${seg.note ? `<p class="seg-note">${inlineProse(seg.note)}</p>` : ''}
  ${elementsTable(seg)}
</div>`).join('\n')}
</div>`;
  }).join('\n')}
</div></section>

${Object.keys(spec.codeLists || {}).length ? `<section class="section"><div class="shell">
  <h2>Code lists</h2>
  <p class="section-sub">Only these values are accepted. A code valid in ${esc(g.standard)} but absent here is not accepted by ${esc(g.hub?.name)}.</p>
  <div class="tbl-wrap"><table class="tbl">
  <thead><tr><th>Element</th><th>Code</th><th>Description</th><th>Note</th></tr></thead>
  <tbody>
  ${Object.entries(spec.codeLists).flatMap(([ref, codes]) =>
    codes.map((c, i) => `<tr>
<td class="mono">${i === 0 ? esc(ref) : ''}</td>
<td class="mono">${esc(c.code)}</td>
<td>${esc(c.description || '')}</td>
<td class="el-note">${c.note ? esc(c.note) : ''}</td>
</tr>`)
  ).join('\n')}
  </tbody></table></div>
</div></section>` : ''}

<section class="section"><div class="shell"><div class="twocol">
  <div>
    <h2>Versions</h2>
    <p class="section-sub">A published version is immutable. A change to the hub's requirements creates a new version, and the previous one stays readable so a partner mid-build can see what they were working from.</p>
    <ul class="verlist">
      ${versions.length ? versions.map((v) => `<li>
<span class="ver ${v.version === version?.version ? 'v-cur' : ''}">v${esc(v.version)}</span>
<span>${v.published_at ? esc(new Date(v.published_at).toISOString().slice(0, 10)) : 'draft'}</span>
<span class="rc-note">${esc(v.changelog || '')}</span>
</li>`).join('\n') : `<li><span class="rc-note">This is the first version.</span></li>`}
    </ul>
  </div>
  <div class="tint">
    <h3>About this guide</h3>
    <dl class="kv">
      ${g.authoredBy ? `<dt>Authored by</dt><dd>${esc(g.authoredBy)}</dd>` : ''}
      ${version?.source_name ? `<dt>Compiled from</dt><dd>${esc(version.source_name)}${version.source_pages ? `, ${esc(version.source_pages)} pages` : ''}</dd>` : ''}
      ${g.supersedes ? `<dt>Supersedes</dt><dd>${esc(g.supersedes)}</dd>` : ''}
      <dt>Citation coverage</dt><dd>${Math.round(stats.citedFraction * 100)}% of segments, elements and rules cite a source page</dd>
      ${readCount != null ? `<dt>Read</dt><dd>${esc(readCount)} times across all surfaces</dd>` : ''}
    </dl>
    ${(spec.contacts || []).length ? `<h3 style="margin-top:18px">Contacts</h3>
    <dl class="kv">${spec.contacts.map((c) => `<dt>${esc(c.role || c.name)}</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}${c.note ? `<br>${esc(c.note)}` : ''}</dd>`).join('')}</dl>` : ''}
  </div>
</div></div></section>

<script>
document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-copy],[data-copy-pre]');
  if (!btn) return;
  var text = btn.getAttribute('data-copy');
  if (!text) {
    var pre = document.getElementById(btn.getAttribute('data-copy-pre'));
    text = pre ? pre.innerText : '';
  }
  if (!text || !navigator.clipboard) return;
  navigator.clipboard.writeText(text).then(function () {
    var was = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(function () { btn.textContent = was; }, 1400);
  });
});
</script>`;

  return layout({
    title: `${g.title} | ${g.hub?.name} | Trading Grid Open Guides`,
    description: `${g.hub?.name} requirements for ${g.standard} ${g.transactionSet} ${g.version}. Hub-attested, versioned, readable by people and agents.`,
    canonical: baseUrl + guidePath,
    body
  });
}
