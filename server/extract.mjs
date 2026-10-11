/**
 * PDF text extraction, page by page.
 *
 * Page numbers are the point. A compiled rule that cites page 12 can be checked
 * against page 12 of the hub's own document in seconds, which is what makes review
 * by exception possible instead of line by line. So extraction keeps the page
 * boundary rather than flattening the document into one string.
 */

let pdfjs = null;

async function loadPdfjs() {
  if (pdfjs) return pdfjs;
  pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs;
}

/**
 * Reassemble text with line breaks. pdfjs gives positioned items; implementation
 * guides are heavily tabular, so dropping vertical position turns a table into
 * unreadable soup. Grouping by y and sorting by x keeps rows intact.
 */
function itemsToText(items) {
  const rows = new Map();
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = Math.round((it.transform?.[5] ?? 0) * 2) / 2;
    const x = it.transform?.[4] ?? 0;
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push({ x, s: it.str });
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, cells]) =>
      cells
        .sort((a, b) => a.x - b.x)
        .map((c) => c.s)
        .join(' ')
        .replace(/\s{2,}/g, '  ')
        .trimEnd()
    )
    .filter((l) => l.trim())
    .join('\n');
}

export async function extractPages(buffer, { maxPages = 120 } = {}) {
  const lib = await loadPdfjs();
  const doc = await lib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
    disableFontFace: true
  }).promise;

  const total = doc.numPages;
  const pages = [];
  const limit = Math.min(total, maxPages);
  for (let i = 1; i <= limit; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push({ page: i, text: itemsToText(content.items) });
    page.cleanup();
  }
  await doc.destroy();

  const charCount = pages.reduce((a, p) => a + p.text.length, 0);
  return {
    pages,
    totalPages: total,
    extractedPages: pages.length,
    truncated: total > limit,
    // A scanned guide yields almost no text. Saying so beats compiling nonsense.
    looksScanned: charCount / Math.max(pages.length, 1) < 120
  };
}

/** Rough transaction-set detection, used to pre-fill the import form. */
export function detectTransactionSets(pages) {
  const counts = new Map();
  const text = pages.map((p) => p.text).join('\n');
  for (const m of text.matchAll(/\b(8[0-9]{2}|2[0-9]{2}|9[0-9]{2}|1[0-9]{2})\b/g)) {
    const code = m[1];
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  const known = new Set([
    '810', '820', '824', '830', '832', '846', '850', '852', '855', '856', '860', '861',
    '864', '865', '869', '870', '940', '943', '944', '945', '947', '204', '210', '214',
    '990', '997', '820', '997'
  ]);
  return [...counts.entries()]
    .filter(([c]) => known.has(c))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, hits]) => ({ code, hits }));
}

export function detectStandardVersion(pages) {
  const text = pages.map((p) => p.text).join('\n');
  const v = text.match(/\b00[2-6]0[0-9]0\b/);
  const edifact = /EDIFACT|UN\/EDIFACT|D\.?9[0-9][AB]|D\.?0[0-9][AB]/i.test(text);
  return {
    standard: edifact && !v ? 'EDIFACT' : 'X12',
    version: v ? v[0] : ''
  };
}
