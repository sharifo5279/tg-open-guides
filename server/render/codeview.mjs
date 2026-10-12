/**
 * Markdown and JSON views of a published guide version.
 *
 * The .md and .json URLs stay raw for agents and scripts. These pages are for
 * a person who wants to read the same payload before wiring it up.
 */
import { esc, layout } from './html.mjs';
import { codeView } from '../highlight.mjs';

const FORMATS = {
  md: { label: 'Markdown', lang: 'markdown', ext: '.md' },
  json: { label: 'JSON', lang: 'json', ext: '.json' }
};

export function renderCodeView({ guide, version, format, source, baseUrl = '', guidePath }) {
  const f = FORMATS[format];
  const rawUrl = `${guidePath}${f.ext}`;
  const lines = String(source).split('\n').length;
  const bytes = Buffer.byteLength(source, 'utf8');
  const cacheKey = `${guide.hub_slug}/${guide.slug}/v${version.version}/${format}`;

  const body = `
<div class="crumbs"><div class="wide">
  <a href="/">Hubs</a><span>/</span>
  <a href="/h/${esc(guide.hub_slug)}">${esc(guide.hub_name || guide.hub?.name || guide.hub_slug)}</a><span>/</span>
  <a href="${esc(guidePath)}">${esc(guide.transaction_set)} ${esc(guide.std_version)}</a><span>/</span>
  <b>${esc(f.label)}</b>
</div></div>

<div class="guidehead"><div class="wide ghead">
  <div class="ghead-main">
    <h1>${esc(f.label)}</h1>
    <ul class="specline">
      <li><b>${esc(guide.title)}</b></li>
      <li>Guide <b>v${esc(version.version)}</b></li>
      <li>${lines.toLocaleString('en-US')} lines</li>
      <li>${(bytes / 1024).toFixed(1)} KB</li>
    </ul>
  </div>
  <div class="copyrow ghead-aside">
    <button class="btn btn-outline" type="button" data-copy-pre="payload">Copy ${esc(f.label)}</button>
    <a class="btn btn-outline" href="${esc(rawUrl)}">Open raw file</a>
    <a class="btn btn-quiet" href="${esc(guidePath)}">Back to guide</a>
  </div>
</div></div>

<div class="viewbody"><div class="wide">
  <div id="payload" class="codewrap">${codeView(source, f.lang, cacheKey)}</div>
</div></div>

<script>
document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-copy-pre]');
  if (!btn) return;
  var el = document.getElementById(btn.getAttribute('data-copy-pre'));
  if (!el || !navigator.clipboard) return;
  navigator.clipboard.writeText(el.innerText).then(function () {
    var was = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(function () { btn.textContent = was; }, 1400);
  });
});
</script>`;

  return layout({
    title: `${f.label} | ${guide.title} | Trading Grid Open Guides`,
    description: `${f.label} view of ${guide.title}, version ${version.version}.`,
    body,
    canonical: `${baseUrl}${guidePath}/${format}`
  });
}
