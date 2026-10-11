import { esc, attr, inlineProse, layout } from './html.mjs';
import { DIRECTIONS } from '../spec.mjs';

export function renderCatalogue({ guides, baseUrl = '', dbUp = true }) {
  const hubs = new Map();
  for (const g of guides) {
    if (!hubs.has(g.hub_slug)) {
      hubs.set(g.hub_slug, { name: g.hub_name, slug: g.hub_slug, industry: g.hub_industry || '', guides: [] });
    }
    hubs.get(g.hub_slug).guides.push(g);
  }
  const hubList = [...hubs.values()];
  const industries = [...new Set(hubList.map((h) => h.industry).filter(Boolean))].sort();
  const sets = [...new Set(guides.map((g) => g.transaction_set))].sort();
  const attested = guides.filter((g) => g.attested_by).length;

  const row = (g) => `<li class="grow" data-hub="${attr(g.hub_slug)}" data-ind="${attr(g.hub_industry || '')}" data-set="${attr(g.transaction_set)}" data-text="${attr(`${g.hub_name} ${g.title} ${g.transaction_set} ${g.standard} ${g.std_version}`.toLowerCase())}">
  <a class="grow-set" href="/g/${esc(g.hub_slug)}/${esc(g.slug)}">${esc(g.transaction_set)}</a>
  <span class="grow-main">
    <a class="grow-title" href="/g/${esc(g.hub_slug)}/${esc(g.slug)}">${esc(g.title)}</a>
    <span class="grow-meta">${esc(g.standard)} ${esc(g.std_version)} &middot; ${esc(DIRECTIONS[g.direction] || g.direction)} &middot; v${esc(g.cur_version)}</span>
  </span>
  <span class="grow-att">${g.attested_by ? `Attested ${esc(String(g.published_at).slice(0, 10))}` : 'Not attested'}</span>
</li>`;

  const body = `
<div class="phead"><div class="wide">
  <p class="eyebrow">OpenText Business Network</p>
  <h1>Trading Grid Open Guides</h1>
  <p class="lede">EDI implementation guides published by the hub that owns them: versioned, attested, and readable by a partner's people and their AI agents. A guide here is the hub's requirement, not a vendor's interpretation of it.</p>
  <ul class="stats" style="margin-top:18px">
    <li><span class="s-num">${guides.length}</span><span class="s-lab">published guides</span></li>
    <li><span class="s-num">${hubList.length}</span><span class="s-lab">hubs</span></li>
    <li><span class="s-num">${sets.length}</span><span class="s-lab">transaction sets</span></li>
    <li><span class="s-num">${attested}</span><span class="s-lab">attested by a named owner</span></li>
  </ul>
  <div class="copyrow">
    <a class="btn" href="/for-agents">Connect an agent</a>
    <a class="btn btn-outline" href="/builder">Publish a guide</a>
  </div>
</div></div>

${!dbUp ? `<section class="section"><div class="wide"><div class="notice">Running on seeded sample guides. The database is not connected, so publishing is disabled and readership is not being recorded.</div></div></section>` : ''}

<section class="section"><div class="wide">
  <div class="filters">
    <input id="q" class="side-filter" type="search" placeholder="Search hubs, transaction sets, titles" aria-label="Search guides" style="max-width:340px">
    <select id="fInd" class="filt" aria-label="Filter by industry">
      <option value="">All industries</option>
      ${industries.map((i) => `<option value="${attr(i)}">${esc(i)}</option>`).join('')}
    </select>
    <select id="fSet" class="filt" aria-label="Filter by transaction set">
      <option value="">All transaction sets</option>
      ${sets.map((t) => `<option value="${attr(t)}">${esc(t)}</option>`).join('')}
    </select>
    <span id="count" class="rc-note"></span>
  </div>

  ${hubList.map((hub) => `<section class="hubblock" data-hub="${attr(hub.slug)}" data-ind="${attr(hub.industry)}">
    <div class="hubhead">
      <div>
        <h2 class="hub-name">${esc(hub.name)}</h2>
        <p class="hub-ind">${esc(hub.industry)}</p>
      </div>
      <span class="rc-note hub-count">${hub.guides.length} guides</span>
    </div>
    <ul class="glist">${hub.guides.map(row).join('')}</ul>
  </section>`).join('')}

  <p id="empty" class="rc-note" style="display:none">No guide matches that filter.</p>
</div></section>

<section class="section"><div class="wide">
  <div class="twocol">
    <div>
      <h2>Why this exists</h2>
      <p>A buyer hub's implementation guide is usually a PDF behind a portal login. A supplier's developer reads it by hand and translates it into a map. A supplier's agent cannot read it at all: it knows X12 but it does not know this hub. So every new partner relationship starts with a human translation, then a test cycle to discover what the translation got wrong.</p>
      <p>Open Guides publishes the same requirements as structured, cited, versioned data. The page is for the developer. The JSON, Markdown and MCP endpoint are for the agent. Both read the identical attested source.</p>
    </div>
    <div class="tint">
      <h3>What this is not</h3>
      <p class="rc-note">Open Guides publishes requirements. It does not accept your test files, validate them, certify a partner, generate maps, or provision connectivity. Those are separate products. This is the requirements record they read from.</p>
      <h3 style="margin-top:16px">Sample data</h3>
      <p class="rc-note">Every hub and guide on this site is fictional, written to exercise the prototype across industries.</p>
    </div>
  </div>
</div></section>

<style>
.filters { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-bottom:22px; }
.filt { font:400 14px/1.4 var(--sans); color:var(--ink); padding:7px 10px; border:1px solid var(--line); border-radius:8px; background:#fff; }
.filt:focus, #q:focus { outline:2px solid var(--primary); outline-offset:-1px; border-color:var(--primary); }
.hubblock { margin-bottom:26px; }
.hubhead { display:flex; align-items:baseline; justify-content:space-between; gap:16px; padding-bottom:7px; border-bottom:2px solid var(--line); margin-bottom:4px; }
.hub-name { font-size:19px; margin:0; }
.hub-ind { font-size:13px; color:var(--slate); margin:2px 0 0; }
.glist { list-style:none; margin:0; padding:0; }
.grow { display:grid; grid-template-columns:62px minmax(0,1fr) auto; gap:14px; align-items:baseline; padding:9px 4px; border-bottom:1px solid var(--line); }
.grow:last-child { border-bottom:0; }
.grow-set { font-family:var(--mono); font-size:14px; font-weight:700; }
.grow-set:hover { text-decoration:none; }
.grow-main { display:flex; flex-direction:column; gap:1px; min-width:0; }
.grow-title { font-size:15px; color:var(--ink); font-weight:500; }
.grow-meta { font-size:12px; color:var(--slate); }
.grow-att { font-size:12px; color:var(--slate); white-space:nowrap; }
@media (max-width:680px) {
  .grow { grid-template-columns:52px minmax(0,1fr); gap:10px; }
  .grow-att { grid-column:2; font-size:11px; }
  .filters { gap:8px; }
  .filt, #q { flex:1 1 140px; }
}
</style>
<script>
(function () {
  var q = document.getElementById('q'), fInd = document.getElementById('fInd'), fSet = document.getElementById('fSet');
  var rows = Array.prototype.slice.call(document.querySelectorAll('.grow'));
  var blocks = Array.prototype.slice.call(document.querySelectorAll('.hubblock'));
  var count = document.getElementById('count'), empty = document.getElementById('empty');
  function apply() {
    var text = q.value.trim().toLowerCase(), ind = fInd.value, set = fSet.value, shown = 0;
    rows.forEach(function (r) {
      var ok = (!text || r.getAttribute('data-text').indexOf(text) !== -1) &&
               (!ind || r.getAttribute('data-ind') === ind) &&
               (!set || r.getAttribute('data-set') === set);
      r.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
    blocks.forEach(function (b) {
      var any = b.querySelectorAll('.grow:not([style*="none"])').length;
      b.style.display = any ? '' : 'none';
      var c = b.querySelector('.hub-count');
      if (c) c.textContent = any + (any === 1 ? ' guide' : ' guides');
    });
    count.textContent = shown + ' of ' + rows.length + ' guides';
    empty.style.display = shown ? 'none' : '';
  }
  [q, fInd, fSet].forEach(function (el) { el.addEventListener('input', apply); el.addEventListener('change', apply); });
  apply();
})();
</script>`;

  return layout({
    title: 'Trading Grid Open Guides',
    description: `${guides.length} hub-attested EDI implementation guides from ${hubList.length} trading hubs, readable by people and AI agents.`,
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
  <p class="lede">${samples[0]?.kind === 'skeleton'
    ? `A required segment skeleton generated from version ${esc(version.version)} of the published guide. It shows segment order and which elements must be present, not a worked business example: the generator has no order or invoice data to work from, and inventing one would mislead.`
    : `Generated from version ${esc(version.version)} of the published guide, one per scenario the hub expects a partner to handle. Each sample satisfies the hub's own structural rules: hierarchy parentage, the carton count in TD102, the HL count in CTT01, and one valid SSCC per pack.`}</p>
  <div class="copyrow"><a class="btn btn-outline" href="${esc(guidePath)}">Back to the guide</a></div>
</div></div>

<section class="section"><div class="shell">
  <div class="notice">These illustrate structure. They are not certified transactions, and passing a comparison against one does not mean the hub will accept your file. Values the guide pins down are real; anything the generator invented reads <code>SAMPLE</code> or <code>ZZ</code> so you can see at a glance what you still have to supply. SSCC check digits are arithmetically valid so the format is right, but the numbers belong to nobody. The ISA and GS envelope is not generated because its values are specific to your trading relationship.</div>
  ${samples.map((s) => `<div class="scenario">
    <h4>${esc(s.id)} &middot; ${esc(s.name)}</h4>
    ${s.requirement ? `<p class="sc-req">${esc(s.requirement)}</p>` : ''}
    <p class="rc-note">${esc(s.segmentCount)} segments. <a href="${esc(guidePath)}/samples/${esc(s.id)}.edi">Download</a></p>
    <pre><code>${esc(s.edi)}</code></pre>
  </div>`).join('\n')}
</div></section>`;
  return layout({ title: `Sample files | ${g.hub?.name} ${g.transactionSet}`, body, canonical: `${baseUrl}${guidePath}/samples` });
}
