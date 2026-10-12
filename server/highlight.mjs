/**
 * Syntax highlighting for the code blocks the product shows: the MCP
 * configuration and the curl examples.
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
      langs: [import('shiki/langs/json.mjs'), import('shiki/langs/bash.mjs')],
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
