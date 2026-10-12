/**
 * Syntax highlighting for the code the product shows: the MCP configuration,
 * the curl examples, and the Markdown and JSON views of a published guide.
 *
 * Shiki runs here at render time with the github-light theme, so the page
 * ships finished markup and the browser loads no highlighting script. If the
 * highlighter fails to start, codeBlock falls back to a plain escaped block.
 */
import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { esc, attr } from './render/html.mjs';

const THEME = 'github-light';
let hl = null;

export async function initHighlight() {
  try {
    hl = await createHighlighterCore({
      themes: [import('shiki/themes/github-light.mjs')],
      langs: [
        import('shiki/langs/json.mjs'),
        import('shiki/langs/bash.mjs'),
        import('shiki/langs/markdown.mjs')
      ],
      engine: createJavaScriptRegexEngine()
    });
  } catch (err) {
    hl = null;
    console.error('highlighter unavailable, code blocks render unstyled:', err.message);
  }
  return hl !== null;
}

export function codeBlock(code, lang = 'json', { id = '' } = {}) {
  const text = String(code ?? '');
  if (!hl) {
    return `<pre${id ? ` id="${attr(id)}"` : ''}><code>${esc(text)}</code></pre>`;
  }
  try {
    return hl.codeToHtml(text, {
      lang,
      theme: THEME,
      transformers: [{
        pre(node) {
          node.properties.class = 'shiki';
          delete node.properties.style;
          delete node.properties.tabindex;
          if (id) node.properties.id = id;
        }
      }]
    });
  } catch {
    return `<pre${id ? ` id="${attr(id)}"` : ''}><code>${esc(text)}</code></pre>`;
  }
}

/* A published version is immutable, so its highlighted view is cached. The
   cache is bounded because a large hub has more guides than a process should
   hold rendered markup for. */
const views = new Map();
const VIEW_LIMIT = 40;

export function codeView(code, lang, cacheKey = '') {
  if (cacheKey && views.has(cacheKey)) return views.get(cacheKey);
  const text = String(code ?? '');
  let html;
  if (!hl) {
    html = `<pre class="codeview"><code>${esc(text)}</code></pre>`;
  } else {
    try {
      html = hl.codeToHtml(text, {
        lang,
        theme: THEME,
        transformers: [{
          pre(node) {
            node.properties.class = 'shiki codeview';
            delete node.properties.style;
            delete node.properties.tabindex;
          },
          /* Each line is its own block, so the literal newlines between them
             would render as a second blank line. */
          code(node) {
            node.children = node.children.filter(
              (c) => !(c.type === 'text' && c.value === '\n')
            );
          }
        }]
      });
    } catch {
      html = `<pre class="codeview"><code>${esc(text)}</code></pre>`;
    }
  }
  if (cacheKey) {
    if (views.size >= VIEW_LIMIT) views.delete(views.keys().next().value);
    views.set(cacheKey, html);
  }
  return html;
}
