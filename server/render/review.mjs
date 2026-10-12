import { esc, layout, citeTag, inlineProse } from './html.mjs';
import { USAGE, DIRECTIONS, specStats, validateSpec } from '../spec.mjs';
import { listFindings, findingState, findingsSummary } from '../findings.mjs';

/**
 * Review screen. Every finding is a row with a stable ID, a state and inline
 * editing, in the order the guide reads: envelope, structure, rules,
 * scenarios. Filters narrow by state. The draft keeps every change, so the
 * reviewer can leave and return.
 */

const KIND_LABEL = { envelope: 'Envelope', segment: 'Segment', element: 'Element', rule: 'Rule', scenario: 'Scenario' };
const STATE_LABEL = { open: 'Open', confirmed: 'Confirmed', edited: 'Edited', dropped: 'Dropped' };
const USAGE_SHORT = { required: 'M', conditional: 'C', optional: 'O', notUsed: 'N/U' };

function usageSelect(value) {
  return `<select name="usage">${USAGE.map((u) => `<option value="${u}"${value === u ? ' selected' : ''}>${u}</option>`).join('')}</select>`;
}

function field(label, name, value, attrs = '') {
  return `<label><span>${esc(label)}</span><input name="${name}" value="${esc(value ?? '')}" ${attrs}></label>`;
}

function area(label, name, value, rows = 2) {
  return `<label class="fd-wide"><span>${esc(label)}</span><textarea name="${name}" rows="${rows}">${esc(value ?? '')}</textarea></label>`;
}

function valuesText(values) {
  return (values || []).map((v) => `${v.code}  ${v.description || ''}${v.note ? `  (${v.note})` : ''}`).join('\n');
}

function editForm(f) {
  const it = f.item;
  switch (f.kind) {
    case 'segment':
      return `${field('Segment', 'id', it.id, 'class="mono" maxlength="3"')}${field('Position', 'pos', it.pos, 'class="mono"')}${field('Name', 'name', it.name)}
<label><span>Usage</span>${usageSelect(it.usage)}</label>${field('Loop', 'loopId', it.loopId, 'class="mono"')}${field('Max use', 'maxUse', it.maxUse, 'inputmode="numeric"')}
${area('Hub note', 'note', it.note, 2)}`;
    case 'element':
      return `${field('Ref', 'ref', it.ref, 'class="mono"')}${field('Name', 'name', it.name)}<label><span>Usage</span>${usageSelect(it.usage)}</label>
${field('Type', 'type', it.type, 'class="mono" maxlength="3"')}${field('Min', 'min', it.min, 'inputmode="numeric"')}${field('Max', 'max', it.max, 'inputmode="numeric"')}
${area('Hub note', 'note', it.note, 2)}${area('Accepted values, one per line: CODE  description', 'values', valuesText(it.values), 3)}`;
    case 'envelope':
      return `${field('Element', 'ref', it.ref, 'class="mono"')}${field('Name', 'name', it.name)}<label><span>Usage</span>${usageSelect(it.usage)}</label>${field('Required value', 'value', it.value, 'class="mono"')}
${area('Note', 'note', it.note, 2)}`;
    case 'rule':
      return `${area('Rule', 'statement', it.statement, 3)}${field('Applies to', 'appliesTo', it.appliesTo, 'class="mono"')}${area('Rationale', 'rationale', it.rationale, 2)}`;
    case 'scenario':
      return `${field('Name', 'name', it.name)}${area('Description', 'description', it.description, 2)}${area('Requirement', 'requirement', it.requirement, 2)}`;
    default:
      return '';
  }
}

function detail(f) {
  const it = f.item;
  switch (f.kind) {
    case 'segment':
      return `<b>${esc(it.name || '')}</b>${it.loopId ? ` <span class="el-note">loop ${esc(it.loopId)}</span>` : ''}${it.note ? `<span class="st-note">${inlineProse(it.note)}</span>` : ''}`;
    case 'element': {
      const codes = (it.values || []).length ? `<span class="st-note">${it.values.map((v) => `<code>${esc(v.code)}</code> ${esc(v.description || '')}`).join(' &middot; ')}</span>` : '';
      return `${esc(it.name || '')}${it.type ? ` <span class="el-note">${esc(String(it.type).toUpperCase())} ${it.min ?? ''}/${it.max ?? ''}</span>` : ''}${it.note ? `<span class="st-note">${inlineProse(it.note)}</span>` : ''}${codes}`;
    }
    case 'envelope':
      return `${esc(it.name || '')}${it.value ? ` <code>${esc(it.value)}</code>` : ''}${it.note ? `<span class="st-note">${inlineProse(it.note)}</span>` : ''}`;
    case 'rule':
      return `${inlineProse(it.statement || '')}${it.appliesTo ? ` <span class="el-note mono">${esc(it.appliesTo)}</span>` : ''}${it.rationale ? `<span class="st-note">${inlineProse(it.rationale)}</span>` : ''}`;
    case 'scenario':
      return `<b>${esc(it.name || '')}</b>${it.requirement ? `<span class="st-note">${inlineProse(it.requirement)}</span>` : ''}`;
    default:
      return '';
  }
}

function row(f) {
  const it = f.item;
  const state = findingState(it);
  const usage = it.usage ? `<span class="rq rq-${{ required: 'm', conditional: 'c', optional: 'o', notUsed: 'n' }[it.usage] || 'o'}" title="${esc(it.usage)}">${esc(USAGE_SHORT[it.usage] || it.usage)}</span>` : '';
  return `<tr class="fd fd-${f.kind} is-${state}" id="${esc(it.fid)}" data-fid="${esc(it.fid)}" data-state="${state}" data-kind="${f.kind}">
<td class="mono fid"><a href="#${esc(it.fid)}">${esc(it.fid)}</a></td>
<td class="kind">${KIND_LABEL[f.kind]}</td>
<td class="mono ref">${esc(f.ref || '')}</td>
<td class="det">${detail(f)}</td>
<td class="req">${usage}</td>
<td class="cite-c">${citeTag(it.citation)}</td>
<td class="state"><span class="fs fs-${state}">${STATE_LABEL[state]}</span></td>
<td class="acts">
  <button type="button" class="btn-link" data-act="edit">Edit</button>
  ${state === 'open' ? '<button type="button" class="btn-link" data-act="confirm">Confirm</button>' : ''}
  ${state === 'dropped' ? '<button type="button" class="btn-link" data-act="restore">Restore</button>' : '<button type="button" class="btn-link warn" data-act="drop">Drop</button>'}
</td>
</tr>
<tr class="fd-edit" id="${esc(it.fid)}-edit" hidden><td colspan="8">
  <form class="fd-form" data-fid="${esc(it.fid)}">
    <div class="fd-fields">${editForm(f)}</div>
    <div class="fd-form-acts"><button class="btn" type="submit">Save</button><button class="btn btn-outline" type="button" data-act="cancel">Cancel</button><span class="rc-note" data-msg></span></div>
  </form>
</td></tr>`;
}

function sectionRow(label, count, addKind = null) {
  return `<tr class="fd-sec"><td colspan="8">${esc(label)}${count != null ? `<span class="st-count">${count}</span>` : ''}${addKind ? `<button type="button" class="btn-link fd-add" data-add="${addKind}">Add ${addKind}</button>` : ''}</td></tr>${addKind ? addRow(addKind) : ''}`;
}

function addRow(kind) {
  const fields = kind === 'rule'
    ? `${area('Rule', 'statement', '', 3)}${field('Applies to', 'appliesTo', '', 'class="mono"')}${area('Rationale', 'rationale', '', 2)}`
    : `${field('Name', 'name', '')}${area('Description', 'description', '', 2)}${area('Requirement', 'requirement', '', 2)}`;
  return `<tr class="fd-edit" id="add-${kind}" hidden><td colspan="8">
  <form class="fd-form" data-add="${kind}">
    <div class="fd-fields">${fields}</div>
    <div class="fd-form-acts"><button class="btn" type="submit">Add ${kind}</button><button class="btn btn-outline" type="button" data-act="cancel-add">Cancel</button><span class="rc-note" data-msg></span></div>
  </form>
</td></tr>`;
}

function findingsTable(spec) {
  const all = listFindings(spec);
  const rows = [];
  const env = all.filter((f) => f.kind === 'envelope');
  if (env.length) {
    rows.push(sectionRow('Envelope', env.length));
    rows.push(...env.map(row));
  }
  const areas = [['header', 'Heading'], ['detail', 'Detail'], ['summary', 'Summary']];
  for (const [key, label] of areas) {
    const segs = (spec.segments || []).filter((s) => (s.level || 'detail') === key);
    if (!segs.length) continue;
    rows.push(sectionRow(label, segs.length));
    for (const seg of segs) {
      rows.push(row({ kind: 'segment', ref: `${seg.id}${seg.pos ? ` ${seg.pos}` : ''}`, item: seg }));
      for (const el of seg.elements || []) rows.push(row({ kind: 'element', ref: el.ref, item: el, parent: seg }));
    }
  }
  const rules = all.filter((f) => f.kind === 'rule');
  rows.push(sectionRow('Rules', rules.length, 'rule'));
  rows.push(...rules.map(row));
  const sc = all.filter((f) => f.kind === 'scenario');
  rows.push(sectionRow('Scenarios', sc.length, 'scenario'));
  rows.push(...sc.map(row));
  return `<table class="tbl-fd" id="fdtable">
<thead><tr><th>ID</th><th>Kind</th><th>Ref</th><th>Finding</th><th>Req</th><th>Page</th><th>State</th><th></th></tr></thead>
<tbody>${rows.join('\n')}</tbody></table>`;
}

export function renderReview({ imp, spec, versions = [], baseUrl }) {
  const g = spec.guide || {};
  const stats = specStats(spec);
  const check = validateSpec(spec);
  const sum = findingsSummary(spec);
  const gaps = spec.compileReport?.gaps || [];
  const pct = sum.total ? Math.round((sum.reviewed / sum.total) * 100) : 0;
  const latest = versions[0] || null;

  const body = `
<div class="crumbs"><div class="shell">
  <a href="/builder">Guide Builder</a> <span>/</span> <b>${esc(imp.source_name)}</b>
</div></div>

<div class="phead rv-head"><div class="shell">
  <p class="eyebrow">Review</p>
  <h1>${esc(g.title || imp.source_name)}</h1>
  <ul class="specline">
    <li><b>${esc(g.hub?.name || imp.hub_name || 'Hub not set')}</b></li>
    <li>${esc(g.standard || 'X12')} ${esc(g.version || '?')}, set <b>${esc(g.transactionSet || '?')}</b></li>
    <li>${esc(DIRECTIONS[g.direction] || g.direction || '')}</li>
    <li>${stats.segments} segments, ${stats.elements} elements, ${stats.rules} rules</li>
    <li>Compiled by <code>${esc(imp.compiled_by || spec.compileReport?.compiledBy || '')}</code></li>
    ${latest ? `<li>Published as <a href="/g/${esc(latest.hub_slug)}/${esc(latest.guide_slug)}/v/${esc(latest.version)}">v${esc(latest.version)}</a>${latest.attested_at ? ', attested' : ', awaiting attestation'}</li>` : ''}
  </ul>
  <div class="rv-progress" title="${sum.reviewed} of ${sum.total} findings reviewed">
    <div class="rv-bar"><span style="width:${pct}%"></span></div>
    <span class="rv-pct">${sum.reviewed} of ${sum.total} reviewed</span>
  </div>
</div></div>

${gaps.length || check.errors.length ? `<section class="section rv-gaps"><div class="shell">
  ${gaps.length ? `<h3>Compiler gaps</h3><ul class="inline-list">${gaps.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
  ${check.errors.length ? `<h3>Blocking errors</h3><ul class="inline-list">${check.errors.slice(0, 20).map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
</div></section>` : ''}

<div class="rv-tools"><div class="shell rv-tools-in">
  <nav class="filters" aria-label="Filter findings">
    <button type="button" class="chip on" data-filter="all">All <span>${sum.total}</span></button>
    <button type="button" class="chip" data-filter="open">Open <span>${sum.open}</span></button>
    <button type="button" class="chip" data-filter="confirmed">Confirmed <span>${sum.confirmed}</span></button>
    <button type="button" class="chip" data-filter="edited">Edited <span>${sum.edited}</span></button>
    <button type="button" class="chip" data-filter="dropped">Dropped <span>${sum.dropped}</span></button>
  </nav>
  <input class="side-filter rv-search" type="search" id="fdsearch" placeholder="Find by ID, ref or text" aria-label="Find findings">
  <div class="rv-tools-r">
    <button type="button" class="btn-link" id="confirm-open">Confirm all open</button>
    <a class="btn" href="#publish">Publish</a>
  </div>
</div></div>

<section class="section"><div class="shell">
  ${findingsTable(spec)}
  <p class="rc-note" id="fdempty" hidden>No findings match.</p>
</div></section>

<section class="section" id="publish"><div class="shell"><div class="twocol">
  <div>
    <h2>${latest ? 'Publish next version' : 'Publish'}</h2>
    <p class="section-sub">${latest
      ? `Version ${esc(latest.version)} stays as published. Publishing again creates version ${esc(Number(latest.version) + 1)} from the current draft, awaiting attestation.`
      : 'Publishing creates a draft version for attestation. Dropped findings are left out. Nothing is public until it is attested.'}</p>
    ${sum.open ? `<p class="notice">${sum.open} finding${sum.open === 1 ? '' : 's'} still open. They publish as compiled unless confirmed, edited or dropped.</p>` : ''}
    <form method="post" action="/builder/i/${esc(imp.id)}/publish" class="form">
      <div class="formrow">
        <label>Hub name <input name="hubName" value="${esc(g.hub?.name || imp.hub_name || '')}" required></label>
        <label>Transaction set <input name="transactionSet" value="${esc(g.transactionSet || '')}" required></label>
        <label>Version <input name="version" value="${esc(g.version || '')}" required></label>
      </div>
      <label>Guide title <input name="title" value="${esc(g.title && g.title !== g.transactionSet ? g.title : '')}" placeholder="Purchase Order" required></label>
      <label>Visibility
        <select name="visibility">
          <option value="open" selected>Open: any partner can read it</option>
          <option value="approval">Approval: the hub approves each partner</option>
          <option value="unlisted">Unlisted: anyone with the link, not in the catalogue</option>
        </select>
      </label>
      <label>Changelog <input name="changelog" placeholder="${latest ? 'What changed since v' + esc(latest.version) : 'First structured publication'}"></label>
      <button class="btn" type="submit">${latest ? `Publish v${esc(Number(latest.version) + 1)}` : 'Publish draft'}</button>
    </form>
  </div>
  <div class="tint">
    <h3>Versions from this import</h3>
    ${versions.length ? `<ul class="verlist">${versions.map((v) => `<li><span class="ver">v${esc(v.version)}</span><span>${v.attested_at ? 'attested ' + esc(new Date(v.attested_at).toISOString().slice(0, 10)) : 'awaiting attestation'}</span><span><a href="/g/${esc(v.hub_slug)}/${esc(v.guide_slug)}/v/${esc(v.version)}">View</a>${v.attested_at ? '' : ` &middot; <a href="/attest/${esc(v.id)}">Attest</a>`}</span></li>`).join('')}</ul>` : '<p class="rc-note">None yet.</p>'}
    <h3 style="margin-top:16px">Citation coverage</h3>
    <p class="rc-note">${Math.round(stats.citedFraction * 100)}% of items cite a source page.</p>
  </div>
</div></div></section>

<script>
(function () {
  var table = document.getElementById('fdtable');
  var rows = Array.prototype.slice.call(table.querySelectorAll('tr.fd'));
  var filter = 'all', q = '';
  function apply() {
    var shown = 0;
    rows.forEach(function (r) {
      var ok = (filter === 'all' || r.getAttribute('data-state') === filter) &&
               (!q || r.textContent.toUpperCase().indexOf(q) !== -1);
      r.style.display = ok ? '' : 'none';
      if (!ok) { var e = document.getElementById(r.id + '-edit'); if (e) e.hidden = true; }
      if (ok) shown++;
    });
    table.querySelectorAll('tr.fd-sec').forEach(function (s) {
      var n = s.nextElementSibling, any = false;
      while (n && !n.classList.contains('fd-sec')) { if (n.classList.contains('fd') && n.style.display !== 'none') { any = true; break; } n = n.nextElementSibling; }
      s.style.display = any ? '' : 'none';
    });
    document.getElementById('fdempty').hidden = shown > 0;
  }
  document.querySelectorAll('.chip[data-filter]').forEach(function (c) {
    c.addEventListener('click', function () {
      document.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('on'); });
      c.classList.add('on'); filter = c.getAttribute('data-filter'); apply();
      try { sessionStorage.setItem('rvfilter:' + location.pathname, filter); } catch (e) {}
    });
  });
  document.getElementById('fdsearch').addEventListener('input', function (e) { q = e.target.value.trim().toUpperCase(); apply(); });
  try {
    var saved = sessionStorage.getItem('rvfilter:' + location.pathname);
    var chip = saved && document.querySelector('.chip[data-filter="' + saved + '"]');
    if (chip && !location.hash) chip.click();
  } catch (e) {}

  function post(edits) {
    return fetch(location.pathname + '/apply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ edits: edits }) })
      .then(function (r) { return r.json(); });
  }
  function done(fid, j, msgEl) {
    if (!j.ok) { if (msgEl) msgEl.textContent = 'Failed: ' + (j.error || 'unknown'); else alert('Failed: ' + (j.error || 'unknown')); return; }
    try { sessionStorage.setItem('rvfilter:' + location.pathname, filter); } catch (e) {}
    location.hash = fid; location.reload();
  }
  table.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    var tr = btn.closest('tr');
    var fid = tr.getAttribute('data-fid') || (tr.querySelector('form') || {}).getAttribute && tr.querySelector('form').getAttribute('data-fid');
    if (act === 'edit') { var ed = document.getElementById(fid + '-edit'); ed.hidden = !ed.hidden; if (!ed.hidden) { var first = ed.querySelector('input,textarea,select'); if (first) first.focus(); } return; }
    if (act === 'cancel') { document.getElementById(fid + '-edit').hidden = true; return; }
    if (act === 'drop' || act === 'confirm' || act === 'restore') {
      btn.disabled = true;
      post([{ fid: fid, action: act }]).then(function (j) { done(fid, j); }).catch(function (err) { alert(err.message); btn.disabled = false; });
    }
  });
  table.addEventListener('click', function (e) {
    var add = e.target.closest('[data-add]');
    if (add && add.tagName === 'BUTTON') { var r = document.getElementById('add-' + add.getAttribute('data-add')); r.hidden = !r.hidden; if (!r.hidden) r.querySelector('input,textarea').focus(); return; }
    var cancel = e.target.closest('[data-act="cancel-add"]');
    if (cancel) cancel.closest('tr').hidden = true;
  });
  table.addEventListener('submit', function (e) {
    var form = e.target.closest('form.fd-form');
    if (!form) return;
    e.preventDefault();
    if (form.getAttribute('data-add')) {
      var kind = form.getAttribute('data-add'), f2 = {};
      Array.prototype.forEach.call(form.elements, function (el) { if (el.name) f2[el.name] = el.value; });
      var m2 = form.querySelector('[data-msg]'); m2.textContent = 'Saving';
      post([{ action: 'add', kind: kind, fields: f2 }]).then(function (j) { done(j.added && j.added[0] ? j.added[0] : '', j, m2); }).catch(function (err) { m2.textContent = 'Failed: ' + err.message; });
      return;
    }
    var fid = form.getAttribute('data-fid');
    var fields = {};
    Array.prototype.forEach.call(form.elements, function (el) { if (el.name) fields[el.name] = el.value; });
    var msg = form.querySelector('[data-msg]');
    msg.textContent = 'Saving';
    post([{ fid: fid, action: 'edit', fields: fields }]).then(function (j) { done(fid, j, msg); }).catch(function (err) { msg.textContent = 'Failed: ' + err.message; });
  });
  var all = document.getElementById('confirm-open');
  if (all) all.addEventListener('click', function () {
    var open = rows.filter(function (r) { return r.getAttribute('data-state') === 'open' && r.style.display !== 'none'; }).map(function (r) { return { fid: r.getAttribute('data-fid'), action: 'confirm' }; });
    if (!open.length) return;
    if (!confirm('Confirm ' + open.length + ' open finding' + (open.length === 1 ? '' : 's') + ' as compiled?')) return;
    all.disabled = true;
    post(open).then(function (j) { if (j.ok) location.reload(); else { alert('Failed: ' + j.error); all.disabled = false; } });
  });
  if (location.hash) {
    var t = document.getElementById(location.hash.slice(1));
    if (t && t.classList.contains('fd')) { filter = 'all'; apply(); t.classList.add('flash'); }
  }
})();
</script>`;

  return layout({ title: `Review ${esc(imp.source_name)} | Guide Builder`, body, canonical: `${baseUrl}/builder/i/${imp.id}` });
}
