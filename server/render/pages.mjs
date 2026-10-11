import { esc, inlineProse, layout } from './html.mjs';
import { DIRECTIONS } from '../spec.mjs';

export function renderCatalogue({ guides, baseUrl = '', dbUp = true }) {
  const byHub = new Map();
  for (const g of guides) {
    if (!byHub.has(g.hub_slug)) byHub.set(g.hub_slug, { name: g.hub_name, slug: g.hub_slug, guides: [] });
    byHub.get(g.hub_slug).guides.push(g);
  }

  const body = `
<div class="phead"><div class="shell">
  <p class="eyebrow">OpenText Business Network</p>
  <h1>Trading Grid Open Guides</h1>
  <p class="lede">EDI implementation guides published by the hub that owns them, versioned, attested, and readable by a partner's people and their AI agents. A guide here is the hub's requirement, not a vendor's interpretation of it.</p>
  <div class="copyrow">
    <a class="btn" href="/for-agents">Connect an agent</a>
    <a class="btn btn-outline" href="/builder">Publish a guide</a>
  </div>
</div></div>

<section class="section"><div class="shell">
  <h2>Why this exists</h2>
  <div class="twocol">
    <div>
      <p>A buyer hub's implementation guide is usually a PDF behind a portal login. A supplier's developer reads it by hand and translates it into a map. A supplier's agent cannot read it at all: it knows ${esc('X12')} but it does not know this hub. So every new partner relationship starts with a human translation, then a test cycle to discover what the translation got wrong.</p>
      <p>Open Guides publishes the same requirements as structured, cited, versioned data. The page is for the developer. The JSON, Markdown and MCP endpoint are for the agent. Both read the identical attested source.</p>
    </div>
    <div class="tint">
      <h3>What this is not</h3>
      <p class="rc-note">Open Guides publishes requirements. It does not accept your test files, validate them, certify a partner, generate maps, or provision connectivity. Those are separate products. This is the requirements record they read from.</p>
    </div>
  </div>
</div></section>

${!dbUp ? `<section class="section"><div class="shell"><div class="notice">Running on seeded sample guides. The database is not connected, so publishing is disabled and readership is not being recorded.</div></div></section>` : ''}

<section class="section"><div class="shell">
  <div class="hubhead"><h2>Published guides</h2><span class="rc-note">${guides.length} guide${guides.length === 1 ? '' : 's'} from ${byHub.size} hub${byHub.size === 1 ? '' : 's'}</span></div>
  <p class="section-sub">Sample hubs below are fictional, created to exercise the prototype.</p>
  ${[...byHub.values()].map((hub) => `
  <h3 style="margin-top:20px">${esc(hub.name)}</h3>
  <ul class="cat">
    ${hub.guides.map((g) => `<li class="catcard">
      <span class="cc-meta">${esc(g.standard)} ${esc(g.std_version)} &middot; ${esc(g.transaction_set)}</span>
      <span class="cc-title"><a href="/g/${esc(g.hub_slug)}/${esc(g.slug)}">${esc(g.title)}</a></span>
      <p class="cc-sum">${esc(String(g.summary || '').slice(0, 170))}${String(g.summary || '').length > 170 ? '...' : ''}</p>
      <span class="cc-foot">
        <span class="rc-note">v${esc(g.cur_version)}${g.published_at ? `, ${esc(new Date(g.published_at).toISOString().slice(0, 10))}` : ''}</span>
        ${g.attested_by ? `<span class="ot-pill on-track">Attested</span>` : ''}
      </span>
    </li>`).join('\n')}
  </ul>`).join('\n')}
</div></section>`;

  return layout({
    title: 'Trading Grid Open Guides',
    description: 'Hub-attested EDI implementation guides that partners’ people and AI agents can both read.',
    canonical: `${baseUrl}/`,
    body
  });
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
  <p class="lede">An agent asked to build an 856 knows ${esc('X12')}. It does not know that this hub rejects structure 0004, requires one SSCC per carton, and charges back a late transmission. Those facts live in the hub's guide, and this is how an agent gets them.</p>
</div></div>

<section class="section"><div class="shell">
  <h2>Three ways in</h2>
  <div class="twocol">
    <div>
      <h3>1. Fetch the page</h3>
      <p>Every guide URL serves Markdown to a client that asks for it, so a plain fetch works with no setup:</p>
      <pre><code>curl -H "Accept: text/markdown" ${esc(baseUrl)}${esc(examplePath)}</code></pre>
      <p>Or append the format explicitly: <code>${esc(examplePath)}.md</code> and <code>${esc(examplePath)}.json</code>. The catalogue is at <code>/llms.txt</code>.</p>

      <h3 style="margin-top:22px">2. Connect the MCP server</h3>
      <p>Configure once and reach every guide in the catalogue, with tools sized to return a segment or a rule set rather than an entire document:</p>
      <pre id="mcp-config"><code>${esc(mcpConfig)}</code></pre>
      <button class="btn btn-quiet" type="button" data-copy-pre="mcp-config">Copy config</button>

      <h3 style="margin-top:22px">3. Through your provider</h3>
      <p>If an integration provider builds on your behalf, they can read the same endpoints. Nothing here is gated on being an OpenText customer.</p>
    </div>
    <div class="tint">
      <h3>Tools</h3>
      <dl class="kv">
        <dt>search_guides</dt><dd>Find a hub's guide by hub name, transaction set or standard.</dd>
        <dt>get_guide_summary</dt><dd>Small payload: what is required, what rejects, which scenarios matter. Start here.</dd>
        <dt>get_rules</dt><dd>The hub's enforced rules, optionally only the rejecting ones.</dd>
        <dt>get_segment</dt><dd>One segment with its elements and code values.</dd>
        <dt>get_code_list</dt><dd>Accepted values for one element.</dd>
        <dt>get_guide_markdown</dt><dd>The whole guide, when you want it all in context.</dd>
      </dl>
      <h3 style="margin-top:18px">Boundary</h3>
      <p class="rc-note">These endpoints publish requirements. They do not validate a file you have built and they cannot certify you with the hub. If an answer implies your file passes, that is the model talking, not this service.</p>
    </div>
  </div>
</div></section>

<section class="section"><div class="shell">
  <h2>What makes a guide here worth reading</h2>
  <ul class="inline-list">
    <li><b>Attested.</b> A named person at the hub signed the version, with a date. The page says who.</li>
    <li><b>Cited.</b> Each segment, element and rule carries the page of the hub's source document it came from, so a claim can be checked.</li>
    <li><b>Versioned.</b> Published versions are immutable. A requirements change creates a new version and the old one stays readable for a partner mid-build.</li>
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
    description: 'Read a hub’s actual EDI requirements through Markdown, JSON or MCP.',
    canonical: `${baseUrl}/for-agents`,
    body
  });
}

export function renderReadership({ hubSlug, rows, baseUrl = '' }) {
  const total = (rows || []).reduce((a, r) => a + r.reads, 0);
  const agents = (rows || []).filter((r) => r.client_kind === 'agent').reduce((a, r) => a + r.reads, 0);
  const body = `
<div class="phead"><div class="shell">
  <p class="eyebrow">${esc(hubSlug)}</p>
  <h1>Who is reading your requirements</h1>
  <p class="lede">A published guide is only useful if partners read it. This is the evidence that they did, by version and by surface, and it is the signal for which of your rules confuse people most.</p>
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
  <p class="section-sub" style="margin-top:14px">Directional, not built: telling you which partners are still building against an old version, and annotating a rule with how often it causes a production rejection. Both need Trading Grid transaction data behind this surface.</p>
</div></section>`;

  return layout({ title: `Readership | ${hubSlug}`, body, canonical: `${baseUrl}/hub/${hubSlug}/readership` });
}

export function renderNotFound({ baseUrl = '' } = {}) {
  return layout({
    title: 'Not found | Trading Grid Open Guides',
    body: `<div class="phead"><div class="shell"><h1>Not found</h1>
<p class="lede">No guide at this address. It may be unlisted, or it may never have been published.</p>
<div class="copyrow"><a class="btn btn-outline" href="/">Back to the catalogue</a></div></div></div>`
  });
}

export function renderSamples({ guide, version, samples, baseUrl = '' }) {
  const spec = version.spec;
  const g = spec.guide || {};
  const guidePath = `/g/${guide.hub_slug}/${guide.slug}`;
  const body = `
<div class="phead"><div class="shell">
  <p class="eyebrow">${esc(g.hub?.name)} &middot; ${esc(g.standard)} ${esc(g.transactionSet)}</p>
  <h1>Sample files</h1>
  <p class="lede">Generated from version ${esc(version.version)} of the published guide, one per scenario the hub expects a partner to handle. Each sample satisfies the hub's own structural rules: hierarchy parentage, the carton count in TD102, the HL count in CTT01, and one valid SSCC per pack.</p>
  <div class="copyrow"><a class="btn btn-outline" href="${esc(guidePath)}">Back to the guide</a></div>
</div></div>

<section class="section"><div class="shell">
  <div class="notice">These illustrate structure. They are not certified transactions, and passing a comparison against one does not mean the hub will accept your file. Identifiers are invented; SSCC check digits are arithmetically valid so the format is right, but the numbers belong to nobody. The ISA and GS envelope is not generated because its values are specific to your trading relationship.</div>
  ${samples.map((s) => `<div class="scenario">
    <h4>${esc(s.id)} &middot; ${esc(s.name)}</h4>
    ${s.requirement ? `<p class="sc-req">${esc(s.requirement)}</p>` : ''}
    <p class="rc-note">${esc(s.segmentCount)} segments. <a href="${esc(guidePath)}/samples/${esc(s.id)}.edi">Download</a></p>
    <pre><code>${esc(s.edi)}</code></pre>
  </div>`).join('\n')}
</div></section>`;
  return layout({ title: `Sample files | ${g.hub?.name} ${g.transactionSet}`, body, canonical: `${baseUrl}${guidePath}/samples` });
}
