import { esc, attr, inlineProse, layout, severityPill, citeTag } from './html.mjs';
import { DIRECTIONS, buildFlow, flowAbsences, FEED_SETS, ALWAYS_SETS } from '../spec.mjs';

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
  <p class="lede">A buyer hub's EDI requirements, published by the hub that owns them. Versioned, attested by a named person at the hub, and readable by your developers and by the agents working on their behalf.</p>
  <div class="copyrow">
    <a class="btn btn-outline" href="/for-agents">Connect an agent</a>
    <a class="btn btn-quiet" href="/builder">Publish a guide</a>
  </div>
</div></div>

<section class="section tight"><div class="shell">
  <ol class="how">
    <li><span class="hw-n">01</span><h3>Published by the hub</h3><p>The hub publishes its own requirements.</p></li>
    <li><span class="hw-n">02</span><h3>Signed by a person</h3><p>A named person at the hub attests the version.</p></li>
    <li><span class="hw-n">03</span><h3>Read by both</h3><p>The same attested source serves a person and an agent.</p></li>
  </ol>
</div></section>

${!dbUp ? `<section class="section tight"><div class="shell"><div class="notice">Running on seeded sample guides. The database is not connected, so publishing is disabled.</div></div></section>` : ''}

<section class="section"><div class="shell">
  <h2>Hubs publishing here</h2>
  <p class="section-sub">Open the hub that asked you to trade with it. Guides are grouped by direction, so you can see what you have to build before you read a line of it.</p>
  <ul class="hublist">
    ${hubs.map((h) => `<li class="hubrow"><a href="/h/${esc(h.slug)}">
      <span class="hr-name">${esc(h.name)}</span>
      <span class="hr-n">${esc(counts.get(h.slug) || 0)} documents</span>
      <span class="hr-ind">${esc(h.industry || '')}</span>
    </a></li>`).join('')}
  </ul>
  <p class="rc-note" style="margin-top:14px">Hub not listed: ask that hub's EDI contact. OpenText cannot answer for requirements a hub has not published here.</p>
</div></section>

<section class="section"><div class="shell"><div class="twocol">
  <div>
    <h2>What this replaces</h2>
    <p>A hub's implementation guide is usually a PDF behind a portal login. A supplier's developer reads it by hand and turns it into code. A supplier's agent cannot read it at all: it knows X12, it does not know this hub.</p>
    <p>Here the same requirements are structured and cited back to the hub's source document, page by page. The page is for the developer. The JSON, Markdown and MCP endpoint are for the agent.</p>
  </div>
  <div class="tint">
    <h3>What this is not</h3>
    <p class="rc-note">Open Guides publishes requirements. It does not accept your test files, check them, certify you with a hub, generate maps or provision connectivity. Those are separate products.</p>
    <h3 style="margin-top:16px">Sample data</h3>
    <p class="rc-note">Prototype. Every hub, guide, contact and identifier on this site is fictional, written to exercise the product across industries. None of it is a live trading requirement.</p>
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

function flowDoc(g) {
  return `<li class="fs-doc">
  <a class="fs-set" href="/g/${esc(g.hub_slug)}/${esc(g.slug)}">${esc(g.transaction_set)}</a>
  <a class="fs-title" href="/g/${esc(g.hub_slug)}/${esc(g.slug)}">${esc(shortTitle(g.title))}</a>
  ${dirmark(g.direction)}
</li>`;
}

/** The flow card has room for the document, not for a sentence about it. */
function shortTitle(title) {
  return String(title || '').replace(/\s*\([0-9]{3}\)\s*/, ' ').replace(/\s+(supplier|vendor|carrier|warehouse|partner)\s+requirements$/i, '').replace(/\s+specification$/i, '').trim();
}

function docRow(g) {
  return `<li class="drow">
  <a class="dr-set" href="/g/${esc(g.hub_slug)}/${esc(g.slug)}">${esc(g.transaction_set)}</a>
  <span class="dr-main">
    <a class="dr-title" href="/g/${esc(g.hub_slug)}/${esc(g.slug)}">${esc(g.title)}</a>
    <span class="dr-meta">${esc(g.standard)} ${esc(g.std_version)} &middot; guide v${esc(g.cur_version)}</span>
  </span>
  <span class="dr-att${g.attested_by ? '' : ' un'}">${g.attested_by ? `Attested ${esc(String(g.published_at).slice(0, 10))}` : 'Not attested'}</span>
</li>`;
}

function flowSection(hub, guides, roleLabel = null) {
  const flow = buildFlow(guides);
  const absences = flowAbsences(guides, hub.name);
  if (!flow.stages.length && !flow.feeds.length && !flow.other.length) return '';

  return `
  ${roleLabel ? `<h3 class="roleh">If you are a ${esc(ROLE_LABELS[roleLabel] || roleLabel)}</h3>` : ''}
  <ol class="flow">
    ${flow.stages.map((st, i) => `<li class="flowstep">
      <span class="fs-n">Step ${i + 1}</span>
      <span class="fs-label">${esc(st.label)}</span>
      <p class="fs-what">${esc(st.what)}</p>
      <ul class="fs-docs">${st.guides.map(flowDoc).join('')}</ul>
    </li>`).join('')}
    ${flow.other.length ? `<li class="flowstep">
      <span class="fs-n">Also</span>
      <span class="fs-label">Other documents</span>
      <p class="fs-what">Published by ${esc(hub.name)}, outside the usual sequence.</p>
      <ul class="fs-docs">${flow.other.map(flowDoc).join('')}</ul>
    </li>` : ''}
  </ol>
  ${absences.length ? `<p class="flow-note">${absences.map((a) => esc(a)).join(' ')}</p>` : ''}
  ${(flow.feeds.length || flow.always.length) ? `<div class="feeds">
    <h3>Outside the sequence</h3>
    <ul class="feedlist">
      ${flow.feeds.map((g) => `<li>
        <a class="fs-set" href="/g/${esc(g.hub_slug)}/${esc(g.slug)}">${esc(g.transaction_set)}</a>
        <span class="fs-title">${esc(FEED_SETS[g.transaction_set] || shortTitle(g.title))}</span>
        <span class="rc-note">Standing feed, not a step. ${dirmark(g.direction)}</span>
      </li>`).join('')}
      ${flow.always.map((g) => `<li>
        <a class="fs-set" href="/g/${esc(g.hub_slug)}/${esc(g.slug)}">${esc(g.transaction_set)}</a>
        <span class="fs-title">${esc(ALWAYS_SETS[g.transaction_set] || shortTitle(g.title))}</span>
        <span class="rc-note">${esc(hub.ackWindow || 'Returned for every interchange')}, both directions.</span>
      </li>`).join('')}
    </ul>
  </div>` : ''}`;
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
    <span class="att-meta">A hub does not attest as a hub: a named owner signs each guide version. ${hub.attestor ? `Here that is ${esc(hub.attestor.name)}, ${esc(hub.attestor.role)}. ` : ''}OpenText publishes these guides and does not verify them.</span>
  </div>
  <p class="lede" style="font-size:15px;margin-top:14px">What ${esc(hub.name)} requires of ${multiRole
    ? `its ${roles.map((r) => (ROLE_LABELS[r] || r) + 's').join(' and ')}`
    : `a ${esc(ROLE_LABELS[term] || term)}`} trading EDI with it. Hub-wide rules once, then one guide per document.</p>
</div></div>

<section class="section"><div class="shell">
  <h2>The sequence carries requirements</h2>
  <p class="section-sub">${esc(hub.name)} measures its acknowledgment window from the moment a document lands, not from when you get to it. Identifiers set early are quoted verbatim downstream: a purchase order number stripped of leading zeros in your acknowledgment breaks the match at invoice, two documents later. Read the chain before you build a link in it.</p>
  ${flows.map((f) => flowSection(hub, f.guides, f.role)).join('')}
  <p class="rc-note" style="margin-top:16px">The grouping and order shown here are OpenText's, for readability. ${esc(hub.name)} attests the guides, not the sequence.</p>
</div></section>

${rules.length ? `<section class="section"><div class="shell">
  <h2>Rules that apply to every document</h2>
  <p class="section-sub">${esc(hub.name)} enforces these across every transaction set. Stated once here instead of repeated in each guide.</p>
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
  <p class="rc-note" style="margin-bottom:14px">Read once at setup, then never again.</p>
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

<section class="section"><div class="shell">
  <h2>Every document</h2>
  <p class="section-sub">Grouped by direction, because that is how the work splits. What ${esc(hub.name)} sends you, you parse. What you send ${esc(hub.name)} you build, and that is what gets rejected.</p>
  ${outbound.length ? `<div class="dgroup">
    <div class="dgroup-h"><h3>What you send to ${esc(hub.name)}</h3><span class="dg-n">${outbound.length}</span></div>
    <ul class="dlist">${outbound.map(docRow).join('')}</ul>
  </div>` : ''}
  ${inbound.length ? `<div class="dgroup">
    <div class="dgroup-h"><h3>What ${esc(hub.name)} sends you</h3><span class="dg-n">${inbound.length}</span></div>
    <ul class="dlist">${inbound.map(docRow).join('')}</ul>
  </div>` : ''}
  <p class="rc-note" style="margin-top:16px">Attested means a named owner at ${esc(hub.name)} put their name and a date on that version, and the version is immutable: a requirements change publishes a new version and leaves the old one readable for anyone mid-build. It does not mean OpenText reviewed the content, that the guide covers every case ${esc(hub.name)} will send you, or that a conforming file will be accepted.</p>
</div></section>

<section class="section"><div class="shell"><div class="twocol">
  <div>
    <h2>Who owns this</h2>
    <p class="section-sub">Listed by what they can resolve. OpenText publishes the guide; ${esc(hub.name)} decides what is in it.</p>
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
    <h3>Connectivity</h3>
    <p class="rc-note">This page carries no AS2 endpoints, SFTP hosts or certificates. Those come from the hub contact.</p>
    <h3 style="margin-top:16px">Certification</h3>
    <p class="rc-note">Open Guides does not test or certify you. Scheduling a certification is a conversation with ${esc(hub.name)}.</p>
  </div>
</div></div></section>

<section class="section"><div class="shell">
  <div class="agentbox">
    <h3>Connect an agent</h3>
    <p>Every guide here is also served as JSON, as Markdown and through an MCP endpoint, from the same stored version the page renders. An agent that knows X12 does not know that ${esc(hub.name)} rejects one structure code or charges back a late transmission. Point it here and it reads the requirement instead of inferring it.</p>
    <p class="rc-note">A plain fetch works with no setup: <code>curl -H "Accept: text/markdown" ${esc(baseUrl)}/h/${esc(hub.slug)}</code></p>
    <p style="margin:14px 0 6px"><b>Or connect once and reach every hub:</b></p>
    <pre id="mcp-config"><code>${esc(mcpConfig)}</code></pre>
    <div class="copyrow">
      <a class="btn btn-outline" href="/h/${esc(hub.slug)}.md">This hub as Markdown</a>
      <button class="btn btn-quiet" type="button" data-copy-pre="mcp-config">Copy MCP config</button>
      <a class="btn btn-quiet" href="/for-agents">Endpoints and setup</a>
    </div>
    <p class="rc-note" style="margin:14px 0 0">These surfaces publish requirements and nothing more. They do not accept your test file, check it, certify you with ${esc(hub.name)}, generate a map or provision connectivity. If an agent tells you your file will pass, that is the model talking.</p>
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
  <h1>Read a hub's requirements, not the standard</h1>
  <p class="lede">An agent asked to build an 856 knows X12. It does not know that this hub rejects structure 0004, requires one SSCC per carton, and charges back a late transmission. Those facts live in the hub's guide.</p>
</div></div>

<section class="section"><div class="shell"><div class="twocol">
  <div>
    <h3>1. Fetch the page</h3>
    <p>Every guide and every hub serves Markdown to a client that asks for it, so a plain fetch works with no setup:</p>
    <pre><code>curl -H "Accept: text/markdown" ${esc(baseUrl)}${esc(examplePath)}</code></pre>
    <p>Or append the format: <code>${esc(examplePath)}.md</code> and <code>${esc(examplePath)}.json</code>. A whole hub is at <code>/h/&lt;hub&gt;.md</code>. The index is at <code>/llms.txt</code>.</p>

    <h3 style="margin-top:22px">2. Connect the MCP server</h3>
    <p>Configure once and reach every hub, with tools that return a segment or a rule set rather than an entire document:</p>
    <pre id="mcp-config"><code>${esc(mcpConfig)}</code></pre>
    <button class="btn btn-quiet" type="button" data-copy-pre="mcp-config">Copy config</button>

    <h3 style="margin-top:22px">3. Through your provider</h3>
    <p>If an integration provider builds on your behalf, they read the same endpoints. Nothing here is gated on being an OpenText customer.</p>
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
    <h3 style="margin-top:18px">Boundary</h3>
    <p class="rc-note">These endpoints publish requirements. They do not validate a file you have built and cannot certify you with a hub. If an answer implies your file passes, that is the model talking.</p>
  </div>
</div></div></section>

<section class="section"><div class="shell">
  <h2>What makes a guide here worth reading</h2>
  <ul class="inline-list">
    <li><b>Attested.</b> A named person at the hub signed the version, with a date.</li>
    <li><b>Cited.</b> Each segment, element and rule carries the page of the hub's source document it came from.</li>
    <li><b>Versioned.</b> Published versions are immutable. A change publishes a new version and the old one stays readable for a partner mid-build.</li>
    <li><b>Scoped.</b> The guide states what the hub enforces and what it merely prefers, which the standard cannot tell you.</li>
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

export function renderSamples({ guide, version, samples, baseUrl = '' }) {
  const spec = version.spec;
  const g = spec.guide || {};
  const guidePath = `/g/${guide.hub_slug}/${guide.slug}`;
  const skeleton = samples[0]?.kind === 'skeleton';
  const body = `
<div class="phead"><div class="shell">
  <p class="eyebrow">${esc(g.hub?.name)} &middot; ${esc(g.standard)} ${esc(g.transactionSet)}</p>
  <h1>Sample files</h1>
  <p class="lede">${skeleton
    ? `A required segment skeleton generated from version ${esc(version.version)} of the published guide. It shows segment order and which elements must be present, not a worked business example.`
    : `Generated from the segment and element rules in version ${esc(version.version)} of the published guide, one per scenario ${esc(g.hub?.name)} expects a partner to handle.`}</p>
  <div class="copyrow"><a class="btn btn-outline" href="${esc(guidePath)}">Back to the guide</a></div>
</div></div>

<section class="section"><div class="shell">
  <div class="notice">Samples are illustrations, not test files: ${esc(g.hub?.name)} decides what passes. Values the guide pins down are real; anything the generator invented reads <code>SAMPLE</code> or <code>ZZ</code> so you can see what you still have to supply. The ISA and GS envelope is not generated, because those values are specific to your trading relationship.</div>
  ${samples.map((s) => `<div class="scenario">
    <h4>${esc(s.id)} &middot; ${esc(s.name)}</h4>
    ${s.requirement ? `<p class="sc-req">${esc(s.requirement)}</p>` : ''}
    <p class="rc-note">${esc(s.segmentCount)} segments. <a href="${esc(guidePath)}/samples/${esc(s.id)}.edi">Download</a></p>
    <pre><code>${esc(s.edi)}</code></pre>
  </div>`).join('\n')}
</div></section>`;
  return layout({ title: `Sample files | ${g.hub?.name} ${g.transactionSet}`, body, canonical: `${baseUrl}${guidePath}/samples` });
}

export function renderReadership({ hubSlug, rows, baseUrl = '' }) {
  const total = (rows || []).reduce((a, r) => a + r.reads, 0);
  const agents = (rows || []).filter((r) => r.client_kind === 'agent').reduce((a, r) => a + r.reads, 0);
  const body = `
<div class="phead"><div class="shell">
  <p class="eyebrow">${esc(hubSlug)}</p>
  <h1>Who is reading your requirements</h1>
  <p class="lede">A published guide is only useful if partners read it. This is the evidence that they did, by version and by surface.</p>
</div></div>
<section class="section"><div class="shell">
  <ul class="stats">
    <li><span class="s-num">${esc(total)}</span><span class="s-lab">reads recorded</span></li>
    <li><span class="s-num">${esc(agents)}</span><span class="s-lab">by agents, not browsers</span></li>
    <li><span class="s-num">${esc(new Set((rows || []).map((r) => r.slug)).size)}</span><span class="s-lab">guides read</span></li>
  </ul>
</div></section>
<section class="section"><div class="shell">
  <h2>Detail</h2>
  ${!rows ? `<div class="notice">Readership needs the database, which is not connected.</div>`
    : rows.length === 0 ? `<div class="notice">Nothing recorded yet. Share a guide link and readership appears here.</div>`
    : `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Guide</th><th>Version</th><th>Surface</th><th>Client</th><th>Reads</th><th>Last read</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
      <td class="mono">${esc(r.transaction_set)}</td>
      <td class="mono">v${esc(r.version ?? '-')}</td>
      <td>${esc(r.surface)}</td>
      <td>${esc(r.client_name)} <span class="rc-note">(${esc(r.client_kind)})</span></td>
      <td class="mono">${esc(r.reads)}</td>
      <td class="rc-note">${esc(new Date(r.last_read).toISOString().replace('T', ' ').slice(0, 16))}</td>
    </tr>`).join('')}</tbody></table></div>`}
</div></section>`;

  return layout({ title: `Readership | ${hubSlug}`, body, canonical: `${baseUrl}/hub/${hubSlug}/readership` });
}

export function renderNotFound() {
  return layout({
    title: 'Not found | Trading Grid Open Guides',
    body: `<div class="phead"><div class="shell"><h1>Not found</h1>
<p class="lede">No guide at this address. It may be unlisted, or it may never have been published.</p>
<div class="copyrow"><a class="btn btn-outline" href="/">Back to the hubs</a></div></div></div>`
  });
}
