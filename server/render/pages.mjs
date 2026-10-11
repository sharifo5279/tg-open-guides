import { esc, inlineProse, layout, severityPill } from './html.mjs';
import { DIRECTIONS } from '../spec.mjs';

/**
 * Home and the hub front door.
 *
 * The guide page is a reference document and is built like one. These two are
 * the opposite job: a supplier who has just been sent a link and needs to find
 * out who this hub is and what they are being asked to build. No search, no
 * filters, no catalogue. One hub is one community, and everything a partner
 * needs sits inside it.
 */

/* -------------------------------------------------------------------- home */

export function renderHome({ hubs, guides, baseUrl = '', dbUp = true }) {
  const counts = new Map();
  for (const g of guides) counts.set(g.hub_slug, (counts.get(g.hub_slug) || 0) + 1);

  const body = `
<div class="phead"><div class="shell">
  <p class="eyebrow">OpenText Business Network</p>
  <h1>Trading Grid Open Guides</h1>
  <p class="lede">EDI integration requirements published and attested by each trading hub.</p>
  <div class="copyrow">
    <a class="btn btn-outline" href="/for-agents">Connect an agent</a>
    <a class="btn btn-quiet" href="/builder">Publish a guide</a>
  </div>
</div></div>

<section class="section tight"><div class="shell">
  <ol class="how">
    <li><span class="hw-n">01</span><h3>Hub-published</h3><p>Each hub maintains its own requirements.</p></li>
    <li><span class="hw-n">02</span><h3>Attested</h3><p>Authorized representative and approval date recorded.</p></li>
    <li><span class="hw-n">03</span><h3>Machine-readable</h3><p>Page, JSON, Markdown and MCP from one source.</p></li>
  </ol>
</div></section>

${!dbUp ? `<section class="section tight"><div class="shell"><div class="notice">Running on seeded sample guides. The database is not connected, so publishing is disabled.</div></div></section>` : ''}

<section class="section"><div class="shell">
  <h2>Trading hubs</h2>
  <p class="section-sub">Open the hub that asked you to trade with it.</p>
  <ul class="hublist">
    ${hubs.map((h) => `<li class="hubrow"><a href="/h/${esc(h.slug)}">
      <span class="hr-name">${esc(h.name)}</span>
      <span class="hr-n">${esc(counts.get(h.slug) || 0)} documents</span>
      <span class="hr-ind">${esc(h.industry || '')}</span>
    </a></li>`).join('')}
  </ul>
  <p class="rc-note" style="margin-top:14px">Hub not listed: contact that hub's EDI team.</p>
</div></section>

<section class="section"><div class="shell"><div class="twocol">
  <div>
    <h2>Guide content</h2>
    <p>Each guide states one hub's requirements for one transaction set: segments, elements, code values and enforced rules.</p>
    <p>Every item cites the page of the hub's source document it was compiled from.</p>
  </div>
  <div class="tint">
    <h3>Limitations</h3>
    <p class="rc-note">Open Guides provides integration requirements. File validation, partner certification, mapping and connectivity are not supported.</p>
    <h3 style="margin-top:16px">Sample data</h3>
    <p class="rc-note">All hubs, guides, contacts and identifiers here are fictional.</p>
  </div>
</div></div></section>`;

  return layout({
    title: 'Trading Grid Open Guides',
    description: "A buyer hub's EDI requirements, published by the hub that owns them and readable by people and AI agents.",
    canonical: `${baseUrl}/`,
    body
  });
}

/* ---------------------------------------------------------------- hub page */

/** The data's role keys are short; the page addresses a person. */
const capitalise = (v) => String(v || '').replace(/^./, (ch) => ch.toUpperCase());

const ROLE_LABELS = {
  carrier: 'carrier',
  warehouse: 'warehouse operator',
  supplier: 'supplier',
  vendor: 'vendor',
  partner: 'trading partner'
};

function dirmark(direction) {
  return direction === 'partner_sends'
    ? '<span class="dirmark out">you send</span>'
    : '<span class="dirmark in">you receive</span>';
}

function docRow(g, role = null) {
  return `<li class="drow">
  <a class="dr-set" href="/g/${esc(g.hub_slug)}/${esc(g.slug)}">${esc(g.transaction_set)}</a>
  <span class="dr-main">
    <a class="dr-title" href="/g/${esc(g.hub_slug)}/${esc(g.slug)}">${esc(g.title)}</a>
    <span class="dr-meta">${esc(g.standard)} ${esc(g.std_version)} &middot; guide v${esc(g.cur_version)}${role ? ` &middot; ${esc(role)}` : ''}</span>
  </span>
  <span class="dr-att${g.attested_by ? '' : ' un'}">${g.attested_by ? `Attested ${esc(String(g.published_at).slice(0, 10))}` : 'Not attested'}</span>
</li>`;
}

export function renderHub({ hub, guides, baseUrl = '' }) {
  const term = hub.partnerTerm || 'partner';
  const attestedCount = guides.filter((g) => g.attested_by).length;
  const latest = guides
    .map((g) => g.published_at)
    .filter(Boolean)
    .sort()
    .pop();
  const outbound = guides.filter((g) => g.direction === 'partner_sends');
  const inbound = guides.filter((g) => g.direction !== 'partner_sends');

  // A hub whose partners play different roles cannot share one sequence: a
  // carrier reading a warehouse shipping order inside its own flow is misled.
  const roles = [...new Set(Object.values(hub.setRoles || {}))];
  const multiRole = roles.length > 1;
  const flows = multiRole
    ? roles.map((role) => ({
        role,
        guides: guides.filter((g) => (hub.setRoles?.[g.transaction_set] || term) === role)
      })).filter((r) => r.guides.length)
    : [{ role: null, guides }];

  const rules = [...(hub.commonRules || [])].sort((a, b) => {
    const order = { reject: 0, warn: 1, info: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  const d = hub.delimiters || {};
  const env = hub.envelope || {};
  const mcpConfig = JSON.stringify(
    { mcpServers: { 'tg-open-guides': { type: 'http', url: `${baseUrl}/mcp` } } },
    null,
    2
  );

  const body = `
<div class="crumbs"><div class="shell">
  <a href="/">Open Guides</a> <span>/</span> <b>${esc(hub.name)}</b>
</div></div>

<div class="hhero"><div class="shell">
  <p class="eyebrow">EDI requirements</p>
  <h1>${esc(hub.name)}</h1>
  ${hub.legalName ? `<p class="h-legal">${esc(hub.legalName)}</p>` : ''}
  <ul class="specline">
    ${hub.industry ? `<li>${esc(hub.industry)}</li>` : ''}
    <li>X12 <b>${esc(hub.stdVersion)}</b></li>
    ${hub.effectiveFrom ? `<li>Effective <b>${esc(hub.effectiveFrom)}</b></li>` : ''}
    <li><b>${guides.length}</b> documents</li>
  </ul>
  ${hub.about ? `<p class="lede">${esc(hub.about)}</p>` : ''}
  <div class="attested${attestedCount === guides.length && guides.length ? '' : ' unattested'}">
    <span class="att-label">${esc(attestedCount)} of ${esc(guides.length)} guides carry an attested version${latest ? `, most recently ${esc(String(latest).slice(0, 10))}` : ''}.</span>
    <span class="att-meta">${hub.attestor ? `Signed by ${esc(hub.attestor.name)}, ${esc(hub.attestor.role)}. ` : ''}A hub does not attest as a hub: a named owner signs each version.</span>
  </div>
  <p class="lede" style="font-size:15px;margin-top:14px">EDI requirements for ${multiRole
    ? `${esc(hub.name)} ${roles.map((r) => (ROLE_LABELS[r] || r) + 's').join(' and ')}`
    : `${esc(hub.name)} ${esc((ROLE_LABELS[term] || term) + 's')}`}.</p>
</div></div>

<section class="section"><div class="shell">
  <h2>Every document</h2>
  <p class="section-sub">Grouped by direction of exchange.${multiRole ? ` Each document states which ${esc(hub.name)} partner it applies to.` : ''}</p>
  ${outbound.length ? `<div class="dgroup">
    <div class="dgroup-h"><h3>Outbound to ${esc(hub.name)}</h3><span class="dg-n">${outbound.length}</span></div>
    <ul class="dlist">${outbound.map((g) => docRow(g, multiRole ? capitalise(ROLE_LABELS[hub.setRoles?.[g.transaction_set]] || '') : null)).join('')}</ul>
  </div>` : ''}
  ${inbound.length ? `<div class="dgroup">
    <div class="dgroup-h"><h3>Inbound from ${esc(hub.name)}</h3><span class="dg-n">${inbound.length}</span></div>
    <ul class="dlist">${inbound.map((g) => docRow(g, multiRole ? capitalise(ROLE_LABELS[hub.setRoles?.[g.transaction_set]] || '') : null)).join('')}</ul>
  </div>` : ''}
  <p class="rc-note" style="margin-top:16px">Attestation records an authorized representative and approval date. Published versions remain accessible and unchanged. Attestation does not guarantee acceptance of a conforming file.</p>
</div></section>

${rules.length ? `<section class="section"><div class="shell">
  <h2>Hub-wide rules</h2>
  <p class="section-sub">Enforced by ${esc(hub.name)} across every transaction set.</p>
  <ul class="rules">
    ${rules.map((r) => `<li class="rule ${r.severity === 'reject' ? 'rule-reject' : r.severity === 'warn' ? 'rule-warn' : ''}">
      <div class="rule-head">${severityPill(r.severity)}<span class="rule-id">${esc(r.id)}</span>${r.appliesTo ? `<span class="rule-applies">${esc(r.appliesTo)}</span>` : ''}</div>
      <p class="rule-stmt">${inlineProse(r.statement)}</p>
      ${r.rationale ? `<p class="rule-why">${inlineProse(r.rationale)}</p>` : ''}
    </li>`).join('')}
  </ul>
</div></section>` : ''}

<section class="section tight"><div class="shell"><div class="tint">
  <h3>Setup facts</h3>
  <p class="rc-note" style="margin-bottom:14px">Required for initial configuration.</p>
  <div class="factgrid">
    <div class="fact"><p class="f-lab">X12 version</p><p class="f-val mono">${esc(hub.stdVersion)}</p></div>
    <div class="fact"><p class="f-lab">Interchange qualifier</p><p class="f-val mono">${esc(env.qualifier || '')}</p></div>
    <div class="fact"><p class="f-lab">Interchange receiver ID</p><p class="f-val mono">${esc(env.receiverId || '')}</p></div>
    <div class="fact"><p class="f-lab">Application receiver code</p><p class="f-val mono">${esc(env.appReceiverCode || '')}</p></div>
    <div class="fact"><p class="f-lab">Acknowledgment</p><p class="f-val">${esc(hub.ackWindow || '')}</p></div>
    <div class="fact"><p class="f-lab">Interface window</p><p class="f-val">${esc(hub.maintenanceWindow || '')}</p></div>
    <div class="fact"><p class="f-lab">Delimiters</p>
      <ul class="delims">
        <li><b>Segment</b><code>${esc(d.segment)}</code></li>
        <li><b>Element</b><code>${esc(d.element)}</code></li>
        <li><b>Component</b><code>${esc(d.component)}</code></li>
        <li><b>Repetition</b><code>${esc(d.repetition)}</code></li>
      </ul>
    </div>
    ${hub.sourceDoc ? `<div class="fact"><p class="f-lab">Compiled from</p><p class="f-val">${esc(hub.sourceDoc)}${hub.sourcePages ? `, ${esc(hub.sourcePages)} pages` : ''}</p></div>` : ''}
    ${env.senderNote ? `<div class="fact fact-wide"><p class="f-lab">Your sender ID</p><p class="f-val">${esc(env.senderNote)}</p></div>` : ''}
    ${env.usageNote ? `<div class="fact fact-wide"><p class="f-lab">Test to production</p><p class="f-val">${esc(env.usageNote)}</p></div>` : ''}
  </div>
</div></div></section>

<section class="section"><div class="shell"><div class="twocol">
  <div>
    <h2>Contacts</h2>
    <p class="section-sub">Requirement questions are resolved by ${esc(hub.name)}.</p>
    <ul class="contactgrid">
      ${(hub.contacts || []).map((c) => `<li class="contact">
        <p class="c-role">${esc(c.role || '')}</p>
        <p class="c-name">${esc(c.name || '')}</p>
        ${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}
        ${c.note ? `<p class="c-note">${esc(c.note)}</p>` : ''}
      </li>`).join('')}
    </ul>
  </div>
  <div class="tint">
    <h3>Not included</h3>
    <p class="rc-note">AS2 endpoints, SFTP hosts, certificates and certification scheduling. Request these from the hub contact.</p>
  </div>
</div></div></section>

<section class="section"><div class="shell">
  <div class="agentbox">
    <h3>Connect an agent</h3>
    <p>Every guide is served as JSON, Markdown and MCP from the version this page renders.</p>
    <p class="rc-note">Markdown is returned to any client that requests it: <code>curl -H "Accept: text/markdown" ${esc(baseUrl)}/h/${esc(hub.slug)}</code></p>
    <p style="margin:14px 0 6px"><b>MCP configuration, all hubs:</b></p>
    <pre id="mcp-config"><code>${esc(mcpConfig)}</code></pre>
    <div class="copyrow">
      <a class="btn btn-outline" href="/h/${esc(hub.slug)}.md">View Markdown</a>
      <button class="btn btn-quiet" type="button" data-copy-pre="mcp-config">Copy MCP config</button>
      <a class="btn btn-quiet" href="/for-agents">View agent setup</a>
    </div>
    <p class="rc-note" style="margin:14px 0 0">Endpoints provide integration requirements. File validation and hub certification are not supported.</p>
  </div>
</div></section>

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
</script>`;

  return layout({
    title: `${hub.name} | Trading Grid Open Guides`,
    description: `EDI requirements ${hub.name} places on its trading partners: ${guides.length} attested guides, readable by people and agents.`,
    canonical: `${baseUrl}/h/${hub.slug}`,
    body
  });
}

/** The hub as one Markdown document, for an agent that wants the whole hub. */
export function hubToMarkdown({ hub, guides, baseUrl = '' }) {
  const L = [];
  L.push(`# ${hub.name}`);
  L.push('');
  if (hub.legalName) L.push(`${hub.legalName}. ${hub.industry || ''}`);
  if (hub.about) L.push(hub.about);
  L.push('');
  L.push(`- Standard: X12 ${hub.stdVersion}`);
  if (hub.effectiveFrom) L.push(`- Effective from: ${hub.effectiveFrom}`);
  L.push(`- Documents published: ${guides.length}`);
  if (hub.ackWindow) L.push(`- Acknowledgment: ${hub.ackWindow}`);
  if (hub.maintenanceWindow) L.push(`- Interface window: ${hub.maintenanceWindow}`);
  L.push(`- Canonical: ${baseUrl}/h/${hub.slug}`);
  L.push('');
  L.push('This document publishes requirements. It does not validate, test or certify a file.');
  L.push('');

  L.push('## Envelope');
  L.push('');
  const env = hub.envelope || {};
  L.push(`- Interchange qualifier: ${env.qualifier || ''}`);
  L.push(`- Interchange receiver ID: ${env.receiverId || ''}`);
  L.push(`- Application receiver code: ${env.appReceiverCode || ''}`);
  if (env.senderNote) L.push(`- Your sender ID: ${env.senderNote}`);
  if (env.usageNote) L.push(`- Test to production: ${env.usageNote}`);
  const d = hub.delimiters || {};
  L.push(`- Delimiters: segment \`${d.segment}\`, element \`${d.element}\`, component \`${d.component}\`, repetition \`${d.repetition}\``);
  L.push('');

  if ((hub.commonRules || []).length) {
    L.push('## Rules that apply to every document');
    L.push('');
    for (const r of hub.commonRules) {
      L.push(`### ${r.id} [${r.severity}]${r.appliesTo ? ` applies to ${r.appliesTo}` : ''}`);
      L.push(r.statement);
      if (r.rationale) L.push(`Reason: ${r.rationale}`);
      L.push('');
    }
  }

  L.push('## Documents');
  L.push('');
  for (const g of guides) {
    L.push(`- ${g.transaction_set} ${g.title}. ${DIRECTIONS[g.direction] || g.direction}. Guide v${g.cur_version}${g.attested_by ? `, attested by ${g.attested_by}` : ', not attested'}. ${baseUrl}/g/${g.hub_slug}/${g.slug}.md`);
  }
  L.push('');

  if ((hub.contacts || []).length) {
    L.push('## Contacts');
    L.push('');
    for (const c of hub.contacts) {
      L.push(`- ${c.role ? `${c.role}: ` : ''}${c.name || ''}${c.email ? ` <${c.email}>` : ''}${c.note ? `. ${c.note}` : ''}`);
    }
    L.push('');
  }
  return L.join('\n');
}

export function renderForAgents({ baseUrl = '', guides = [] }) {
  const mcpConfig = JSON.stringify(
    { mcpServers: { 'tg-open-guides': { type: 'http', url: `${baseUrl}/mcp` } } },
    null,
    2
  );
  const example = guides[0];
  const examplePath = example ? `/g/${example.hub_slug}/${example.slug}` : '/g/crestfield/856-004010';

  const body = `
<div class="phead"><div class="shell">
  <p class="eyebrow">For agents and developers</p>
  <h1>Agent integration</h1>
  <p class="lede">Retrieve a hub's enforced requirements in machine-readable form.</p>
</div></div>

<section class="section"><div class="shell"><div class="twocol">
  <div>
    <h3>HTTP fetch</h3>
    <p>Guides and hubs return Markdown to any client that requests it:</p>
    <pre><code>curl -H "Accept: text/markdown" ${esc(baseUrl)}${esc(examplePath)}</code></pre>
    <p>Or append the format: <code>${esc(examplePath)}.md</code> and <code>${esc(examplePath)}.json</code>. A whole hub is at <code>/h/&lt;hub&gt;.md</code>.</p>

    <h3 style="margin-top:22px">MCP server</h3>
    <p>Tools return a segment or rule set rather than a full document:</p>
    <pre id="mcp-config"><code>${esc(mcpConfig)}</code></pre>
    <button class="btn btn-quiet" type="button" data-copy-pre="mcp-config">Copy config</button>

    <h3 style="margin-top:22px">Integration provider</h3>
    <p>Providers use the same endpoints. No OpenText account is required.</p>
  </div>
  <div class="tint">
    <h3>Tools</h3>
    <dl class="kv">
      <dt>search_guides</dt><dd>Find a hub's guide by hub, transaction set or standard.</dd>
      <dt>get_guide_summary</dt><dd>Small payload: what is required, what rejects, which scenarios matter. Start here.</dd>
      <dt>get_rules</dt><dd>The hub's enforced rules, optionally only the rejecting ones.</dd>
      <dt>get_segment</dt><dd>One segment with its elements and code values.</dd>
      <dt>get_code_list</dt><dd>Accepted values for one element.</dd>
      <dt>get_sample</dt><dd>A structural sample for one scenario.</dd>
      <dt>get_guide_markdown</dt><dd>The whole guide, when you want it all in context.</dd>
    </dl>
    <h3 style="margin-top:18px">Limitations</h3>
    <p class="rc-note">Endpoints provide integration requirements. File validation and hub certification are not supported.</p>
  </div>
</div></div></section>

<section class="section"><div class="shell">
  <h2>Guide publishing standards</h2>
  <ul class="inline-list">
    <li><b>Hub attestation:</b> authorized representative and approval date recorded.</li>
    <li><b>Source citation:</b> each segment, element and rule cites its source document page.</li>
    <li><b>Version history:</b> published versions remain accessible and unchanged.</li>
    <li><b>Enforcement scope:</b> each rule states whether the hub rejects, holds or advises.</li>
  </ul>
</div></section>

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
</script>`;

  return layout({
    title: 'For agents | Trading Grid Open Guides',
    description: "Read a hub's actual EDI requirements through Markdown, JSON or MCP.",
    canonical: `${baseUrl}/for-agents`,
    body
  });
}

export function renderNotFound() {
  return layout({
    title: 'Not found | Trading Grid Open Guides',
    body: `<div class="phead"><div class="shell"><h1>Not found</h1>
<p class="lede">No guide at this address. The guide may be unlisted or unpublished.</p>
<div class="copyrow"><a class="btn btn-outline" href="/">Back to the hubs</a></div></div></div>`
  });
}
