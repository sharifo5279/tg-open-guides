/**
 * The compiler: a hub's PDF implementation guide becomes a structured draft spec.
 *
 * Two design commitments shape everything here.
 *
 * Citations are mandatory. Every item the compiler emits carries the page it came
 * from, because review by exception only works if a reviewer can check one claim in
 * seconds. An item with no citation is treated as low confidence by definition.
 *
 * Confidence is reported, not hidden. The compiler says which items it is unsure
 * about and what it expected to find and did not. Those two lists are the review
 * queue, and the second one is often more valuable to the hub than the draft itself,
 * because a gap in their own guide is news to them.
 */
import { complete, parseJsonLoose, modelAvailable, modelName } from './model.mjs';
import { emptySpec, USAGE } from './spec.mjs';
import { detectStandardVersion } from './extract.mjs';

const CHUNK_PAGES = 10;
const CHUNK_OVERLAP = 1;

const SYSTEM = `You compile EDI implementation guides into structured JSON.

You are reading pages of one trading partner's implementation guide: a buyer hub telling its suppliers what it requires. Your job is to extract what the hub REQUIRES, not to teach the X12 or EDIFACT standard. If a page restates the standard without hub-specific constraint, extract it only when it carries a usage, a length, a code restriction or a note.

Rules you must follow:
1. Cite everything. Every segment, element and rule carries "citation": {"page": N} using the page numbers given in the input. Never invent a page number. If you cannot attribute an item to a page, omit the item.
2. Never invent requirements. If the pages do not say it, it does not exist. Do not fill gaps from your knowledge of the standard or of how other hubs work.
3. Mark your confidence honestly. "confidence": "high" when the page states it plainly, "low" when you are inferring from a table that was hard to read, from ambiguous wording, or from a partial page.
4. Rules are the hub's enforced constraints that are not expressible as a usage or a code list: uniqueness, cross-segment equality, timing, counts, matching against external data. Assign severity "reject" when the guide says the transaction is rejected or refused, "warn" when it says held, charged back or queried, "info" otherwise.
5. Quote the hub's own wording where you can. Do not editorialise and do not soften a requirement.

Return JSON only, no prose.`;

function chunkPrompt(pages, meta) {
  const body = pages.map((p) => `--- PAGE ${p.page} ---\n${p.text}`).join('\n\n');
  return `Hub: ${meta.hubName || 'unknown'}
Standard: ${meta.standard || 'X12'} ${meta.version || ''}
Transaction set of interest: ${meta.transactionSet || 'unknown'}

Extract only what these pages state. Pages not shown are handled by other calls, so do not speculate about them.

Return this shape:
{
  "segments": [
    {
      "pos": "0200",
      "id": "BSN",
      "name": "Beginning Segment for Ship Notice",
      "level": "header|detail|summary",
      "loopId": "HL-S or null",
      "usage": "required|conditional|optional|notUsed",
      "maxUse": 1,
      "note": "the hub's own note, if any",
      "confidence": "high|low",
      "citation": {"page": 9},
      "elements": [
        {
          "ref": "BSN01",
          "id": "353",
          "name": "Transaction Set Purpose Code",
          "type": "ID",
          "min": 2,
          "max": 2,
          "usage": "required",
          "values": [{"code": "00", "description": "Original", "note": null}],
          "note": null,
          "confidence": "high",
          "citation": {"page": 9}
        }
      ]
    }
  ],
  "envelope": { "isa": [], "gs": [], "st": [] },
  "rules": [
    {
      "id": null,
      "severity": "reject|warn|info",
      "statement": "what the partner must do, in the hub's terms",
      "rationale": "why, if the guide says",
      "appliesTo": "BSN05 or HL-P/MAN or transmission",
      "confidence": "high|low",
      "citation": {"page": 10}
    }
  ],
  "scenarios": [{"name": "...", "description": "...", "requirement": "...", "confidence": "high", "citation": {"page": 5}}],
  "contacts": [{"role": "...", "name": "...", "email": "...", "note": "...", "citation": {"page": 2}}],
  "delimiters": {"segment": "~", "element": "*", "component": ">", "repetition": "^"},
  "notFound": ["things these pages referenced but did not define, in short phrases"]
}

Envelope entries use {"ref": "ISA05", "name": "...", "usage": "required", "value": "01 if the hub mandates a literal value", "note": "...", "confidence": "high", "citation": {"page": 6}}.

Omit any array you found nothing for. Pages:

${body}`;
}

function normUsage(u) {
  const s = String(u || '').toLowerCase();
  if (s.startsWith('r') || s === 'm' || s === 'mandatory') return 'required';
  if (s.startsWith('c')) return 'conditional';
  if (s.startsWith('n')) return 'notUsed';
  if (s.startsWith('o')) return 'optional';
  return USAGE.includes(u) ? u : 'optional';
}

function cleanCitation(c, allowedPages) {
  const page = Number.parseInt(c?.page, 10);
  if (!Number.isFinite(page)) return null;
  // A page the model was not shown is a hallucinated citation.
  if (allowedPages && !allowedPages.has(page)) return null;
  return { page };
}

function mergeSegments(target, incoming, allowedPages) {
  for (const raw of incoming || []) {
    if (!raw?.id) continue;
    const seg = {
      pos: raw.pos ? String(raw.pos) : null,
      id: String(raw.id).toUpperCase().trim(),
      name: raw.name || '',
      level: raw.level || 'detail',
      loopId: raw.loopId || null,
      usage: normUsage(raw.usage),
      maxUse: Number.isFinite(Number(raw.maxUse)) ? Number(raw.maxUse) : null,
      note: raw.note || null,
      confidence: raw.confidence === 'high' ? 'high' : 'low',
      citation: cleanCitation(raw.citation, allowedPages),
      elements: []
    };
    if (!seg.citation) seg.confidence = 'low';
    for (const el of raw.elements || []) {
      if (!el?.ref) continue;
      const e = {
        ref: String(el.ref).toUpperCase().trim(),
        id: el.id ? String(el.id) : null,
        name: el.name || '',
        type: el.type || null,
        min: Number.isFinite(Number(el.min)) ? Number(el.min) : null,
        max: Number.isFinite(Number(el.max)) ? Number(el.max) : null,
        usage: normUsage(el.usage),
        values: (el.values || [])
          .filter((v) => v?.code != null)
          .map((v) => ({ code: String(v.code), description: v.description || '', note: v.note || null })),
        note: el.note || null,
        confidence: el.confidence === 'high' ? 'high' : 'low',
        citation: cleanCitation(el.citation, allowedPages)
      };
      if (!e.citation) e.confidence = 'low';
      seg.elements.push(e);
    }

    const key = `${seg.id}|${seg.loopId || ''}|${seg.pos || ''}`;
    const existing = target.find((s) => `${s.id}|${s.loopId || ''}|${s.pos || ''}` === key);
    if (!existing) {
      target.push(seg);
      continue;
    }
    // Same segment seen in an overlapping chunk: keep the richer description.
    if (!existing.name && seg.name) existing.name = seg.name;
    if (!existing.note && seg.note) existing.note = seg.note;
    if (!existing.citation && seg.citation) existing.citation = seg.citation;
    if (existing.confidence === 'low' && seg.confidence === 'high') existing.confidence = 'high';
    for (const e of seg.elements) {
      const prev = existing.elements.find((x) => x.ref === e.ref);
      if (!prev) {
        existing.elements.push(e);
      } else {
        if (!prev.name && e.name) prev.name = e.name;
        if (!prev.note && e.note) prev.note = e.note;
        if (!prev.citation && e.citation) prev.citation = e.citation;
        if (!prev.values.length && e.values.length) prev.values = e.values;
        if (prev.confidence === 'low' && e.confidence === 'high') prev.confidence = 'high';
      }
    }
  }
}

function mergeEnvelope(target, incoming, allowedPages) {
  for (const key of ['isa', 'gs', 'st']) {
    for (const raw of incoming?.[key] || []) {
      if (!raw?.ref) continue;
      const row = {
        ref: String(raw.ref).toUpperCase().trim(),
        name: raw.name || '',
        usage: normUsage(raw.usage),
        value: raw.value || null,
        note: raw.note || null,
        confidence: raw.confidence === 'high' ? 'high' : 'low',
        citation: cleanCitation(raw.citation, allowedPages)
      };
      if (!row.citation) row.confidence = 'low';
      if (!target[key].some((r) => r.ref === row.ref)) target[key].push(row);
    }
  }
}

function mergeRules(target, incoming, allowedPages) {
  for (const raw of incoming || []) {
    if (!raw?.statement) continue;
    const statement = String(raw.statement).trim();
    // Chunk overlap produces near-duplicates; first 60 characters is a good enough key.
    const fingerprint = statement.slice(0, 60).toLowerCase();
    if (target.some((r) => r.statement.slice(0, 60).toLowerCase() === fingerprint)) continue;
    const severity = ['reject', 'warn', 'info'].includes(raw.severity) ? raw.severity : 'info';
    const citation = cleanCitation(raw.citation, allowedPages);
    target.push({
      id: null,
      severity,
      statement,
      rationale: raw.rationale || null,
      appliesTo: raw.appliesTo || null,
      confidence: citation && raw.confidence === 'high' ? 'high' : 'low',
      citation
    });
  }
}

/** Things a publishable guide normally has. Absence is reported, never invented. */
function findGaps(spec, notFound) {
  const gaps = [];
  const ids = new Set((spec.segments || []).map((s) => s.id));
  const g = spec.guide || {};

  if (!g.transactionSet) gaps.push('The transaction set code was not stated anywhere the compiler could find.');
  if (!g.version) gaps.push('The standard version (for example 004010) was not found.');
  if (!spec.envelope?.isa?.length) gaps.push('No ISA interchange requirements found. Partners will not know which sender and receiver qualifiers to use.');
  if (!spec.envelope?.gs?.length) gaps.push('No GS functional group requirements found.');
  if (!ids.has('ST') || !ids.has('SE')) gaps.push('ST or SE is missing from the extracted structure, which means the transaction envelope is incomplete.');
  if (!(spec.rules || []).some((r) => r.severity === 'reject')) {
    gaps.push('No rejecting rules were found. Either the guide does not say what causes a rejection, or the compiler missed it. This is the single most useful thing to add for partners.');
  }
  if (!(spec.scenarios || []).length) gaps.push('No test scenarios found. Partners will guess which cases to prove before certification.');
  if (!(spec.contacts || []).length) gaps.push('No support contact found.');

  const parentless = (spec.segments || []).filter((s) => s.loopId && !s.pos);
  if (parentless.length) gaps.push(`${parentless.length} segment(s) have a loop but no position, so ordering is a guess.`);

  for (const n of new Set(notFound || [])) {
    if (typeof n === 'string' && n.trim()) gaps.push(`Referenced but not defined in the document: ${n.trim()}`);
  }
  return gaps;
}

function assignRuleIds(rules) {
  rules.forEach((r, i) => {
    r.id = `R-${String(i + 1).padStart(3, '0')}`;
  });
  return rules;
}

/* ---------------------------------------------------------- model compilation */

export async function compileWithModel(pages, meta = {}, { onProgress } = {}) {
  const spec = emptySpec();
  const notFound = [];
  const chunks = [];
  for (let i = 0; i < pages.length; i += CHUNK_PAGES - CHUNK_OVERLAP) {
    chunks.push(pages.slice(i, i + CHUNK_PAGES));
    if (i + CHUNK_PAGES >= pages.length) break;
  }

  const sv = detectStandardVersion(pages);
  const effectiveMeta = {
    ...meta,
    standard: meta.standard || sv.standard,
    version: meta.version || sv.version
  };

  let failures = 0;
  for (const [i, chunk] of chunks.entries()) {
    const allowed = new Set(chunk.map((p) => p.page));
    onProgress?.({ chunk: i + 1, chunks: chunks.length });
    try {
      const text = await complete({
        system: SYSTEM,
        prompt: chunkPrompt(chunk, effectiveMeta),
        maxTokens: 8000
      });
      const parsed = parseJsonLoose(text);
      mergeSegments(spec.segments, parsed.segments, allowed);
      mergeEnvelope(spec.envelope, parsed.envelope, allowed);
      mergeRules(spec.rules, parsed.rules, allowed);
      for (const s of parsed.scenarios || []) {
        if (!s?.name) continue;
        if (spec.scenarios.some((x) => x.name === s.name)) continue;
        spec.scenarios.push({
          id: null,
          name: s.name,
          description: s.description || '',
          requirement: s.requirement || '',
          confidence: s.confidence === 'high' ? 'high' : 'low',
          citation: cleanCitation(s.citation, allowed)
        });
      }
      for (const c of parsed.contacts || []) {
        if (!c?.email && !c?.name) continue;
        if (spec.contacts.some((x) => x.email === c.email && x.name === c.name)) continue;
        spec.contacts.push({ role: c.role || '', name: c.name || '', email: c.email || '', note: c.note || '' });
      }
      if (parsed.delimiters && i === 0) {
        spec.delimiters = { ...spec.delimiters, ...parsed.delimiters };
      }
      for (const n of parsed.notFound || []) notFound.push(n);
    } catch (err) {
      failures += 1;
      console.warn(`[compile] chunk ${i + 1}/${chunks.length} failed: ${err.message}`);
      notFound.push(`pages ${chunk[0].page} to ${chunk[chunk.length - 1].page} could not be compiled (${err.message.slice(0, 80)})`);
    }
  }

  // Order by position where the guide gave one, otherwise keep discovery order.
  spec.segments.sort((a, b) => {
    const levels = { header: 0, detail: 1, summary: 2 };
    const lv = (levels[a.level] ?? 1) - (levels[b.level] ?? 1);
    if (lv !== 0) return lv;
    return 0;
  });

  spec.scenarios.forEach((s, i) => {
    s.id = `S-${i + 1}`;
  });
  assignRuleIds(spec.rules);

  spec.guide = {
    ...spec.guide,
    hub: { name: meta.hubName || '', slug: meta.hubSlug || '' },
    title: meta.title || '',
    standard: effectiveMeta.standard,
    transactionSet: meta.transactionSet || '',
    version: effectiveMeta.version,
    direction: meta.direction || 'partner_sends',
    authoredBy: meta.authoredBy || null
  };

  spec.compileReport = {
    compiledBy: modelName(),
    chunks: chunks.length,
    failedChunks: failures,
    gaps: findGaps(spec, notFound)
  };
  return spec;
}

export async function compileGuide(pages, meta = {}, opts = {}) {
  if (!modelAvailable()) {
    throw new Error('No model key is configured, so a PDF cannot be compiled. Set ANTHROPIC_API_KEY or GEMINI_API_KEY.');
  }
  return compileWithModel(pages, meta, opts);
}

/** Split a draft into the review queue: what to check, and what is merely confirmed. */
export function triage(spec) {
  const low = [];
  const high = [];
  for (const seg of spec.segments || []) {
    const target = seg.confidence === 'high' && seg.citation ? high : low;
    target.push({ kind: 'segment', ref: `${seg.id}${seg.pos ? ` ${seg.pos}` : ''}`, item: seg });
    for (const el of seg.elements || []) {
      const t = el.confidence === 'high' && el.citation ? high : low;
      t.push({ kind: 'element', ref: `${seg.id}.${el.ref}`, item: el, parent: seg });
    }
  }
  for (const key of ['isa', 'gs', 'st']) {
    for (const row of spec.envelope?.[key] || []) {
      const t = row.confidence === 'high' && row.citation ? high : low;
      t.push({ kind: 'envelope', ref: row.ref, item: row, group: key });
    }
  }
  for (const rule of spec.rules || []) {
    const t = rule.confidence === 'high' && rule.citation ? high : low;
    t.push({ kind: 'rule', ref: rule.id, item: rule });
  }
  for (const s of spec.scenarios || []) {
    const t = s.confidence === 'high' && s.citation ? high : low;
    t.push({ kind: 'scenario', ref: s.id, item: s });
  }
  return {
    needsReview: low,
    confirmed: high,
    gaps: spec.compileReport?.gaps || [],
    compiledBy: spec.compileReport?.compiledBy || 'unknown',
    note: spec.compileReport?.note || null
  };
}
