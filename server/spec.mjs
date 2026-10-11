/**
 * The Open Guides contract.
 *
 * A guide spec is one JSON document that says what a hub requires of a partner for
 * one transaction set. It is written for two readers at once: a person reading the
 * published page, and an agent reading the JSON or Markdown. Three properties make
 * it worth more than the PDF it came from:
 *
 *  1. Flat and addressable. Segments are an ordered list with a position, not a
 *     nested tree, so an agent can ask for one segment without walking a structure.
 *  2. Cited. Every segment, element and rule carries the source page it came from,
 *     so a hub reviewer can check the compiler and a partner can check the hub.
 *  3. Attested and versioned. A published version names the person at the hub who
 *     signed it. That is the thing a vendor-built catalog cannot claim.
 *
 * Usage values follow X12 convention: required | optional | conditional | notUsed.
 */

export const SPEC_VERSION = 'og/1';

export const USAGE = ['required', 'conditional', 'optional', 'notUsed'];
export const SEVERITY = ['reject', 'warn', 'info'];
export const DIRECTIONS = {
  partner_sends: 'Partner sends to hub',
  partner_receives: 'Partner receives from hub'
};

export function emptySpec(overrides = {}) {
  return {
    specVersion: SPEC_VERSION,
    guide: {
      hub: { name: '', slug: '' },
      title: '',
      standard: 'X12',
      transactionSet: '',
      version: '',
      direction: 'partner_sends',
      summary: '',
      effectiveFrom: null,
      ...overrides.guide
    },
    delimiters: { segment: '~', element: '*', component: '>', repetition: '^' },
    envelope: { isa: [], gs: [], st: [] },
    segments: [],
    codeLists: {},
    rules: [],
    scenarios: [],
    contacts: [],
    ...overrides
  };
}

/**
 * Validation is deliberately about shape and internal consistency, not about whether
 * the hub's requirements are sensible. The hub owns the requirements; we own whether
 * the document is well formed enough to publish and to serve to an agent.
 */
export function validateSpec(spec) {
  const errors = [];
  const warnings = [];

  if (!spec || typeof spec !== 'object') {
    return { ok: false, errors: ['spec is not an object'], warnings: [] };
  }
  if (spec.specVersion !== SPEC_VERSION) {
    warnings.push(`specVersion is "${spec.specVersion}", expected "${SPEC_VERSION}"`);
  }

  const g = spec.guide || {};
  for (const field of ['title', 'standard', 'transactionSet', 'version', 'direction']) {
    if (!g[field]) errors.push(`guide.${field} is missing`);
  }
  if (g.direction && !DIRECTIONS[g.direction]) {
    errors.push(`guide.direction "${g.direction}" is not one of ${Object.keys(DIRECTIONS).join(', ')}`);
  }
  if (!g.hub?.name) errors.push('guide.hub.name is missing');

  if (!Array.isArray(spec.segments) || spec.segments.length === 0) {
    errors.push('segments is empty, there is nothing to publish');
  }

  const seenPos = new Set();
  for (const [i, seg] of (spec.segments || []).entries()) {
    const where = `segments[${i}]${seg?.id ? ` (${seg.id})` : ''}`;
    if (!seg?.id) errors.push(`${where}: id is missing`);
    if (!seg?.pos) warnings.push(`${where}: pos is missing, ordering will fall back to array order`);
    if (seg?.pos) {
      if (seenPos.has(seg.pos)) errors.push(`${where}: duplicate pos "${seg.pos}"`);
      seenPos.add(seg.pos);
    }
    if (seg?.usage && !USAGE.includes(seg.usage)) {
      errors.push(`${where}: usage "${seg.usage}" is not one of ${USAGE.join(', ')}`);
    }
    if (!seg?.citation?.page) warnings.push(`${where}: no source page cited`);
    for (const [j, el] of (seg?.elements || []).entries()) {
      const ew = `${where}.elements[${j}]${el?.ref ? ` (${el.ref})` : ''}`;
      if (!el?.ref) errors.push(`${ew}: ref is missing`);
      if (!el?.name) warnings.push(`${ew}: name is missing`);
      if (el?.usage && !USAGE.includes(el.usage)) {
        errors.push(`${ew}: usage "${el.usage}" is not one of ${USAGE.join(', ')}`);
      }
      if (el?.min != null && el?.max != null && Number(el.min) > Number(el.max)) {
        errors.push(`${ew}: min ${el.min} is greater than max ${el.max}`);
      }
    }
  }

  const seenRule = new Set();
  for (const [i, rule] of (spec.rules || []).entries()) {
    const where = `rules[${i}]${rule?.id ? ` (${rule.id})` : ''}`;
    if (!rule?.id) errors.push(`${where}: id is missing`);
    if (rule?.id) {
      if (seenRule.has(rule.id)) errors.push(`${where}: duplicate rule id "${rule.id}"`);
      seenRule.add(rule.id);
    }
    if (!rule?.statement) errors.push(`${where}: statement is missing`);
    if (rule?.severity && !SEVERITY.includes(rule.severity)) {
      errors.push(`${where}: severity "${rule.severity}" is not one of ${SEVERITY.join(', ')}`);
    }
    if (!rule?.citation?.page) warnings.push(`${where}: no source page cited`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** Counts a hub reviewer and an agent both want up front. */
export function specStats(spec) {
  const segments = spec.segments || [];
  const elements = segments.flatMap((s) => s.elements || []);
  const cited = [
    ...segments.filter((s) => s.citation?.page),
    ...elements.filter((e) => e.citation?.page),
    ...(spec.rules || []).filter((r) => r.citation?.page)
  ].length;
  const citable = segments.length + elements.length + (spec.rules || []).length;
  return {
    segments: segments.length,
    requiredSegments: segments.filter((s) => s.usage === 'required').length,
    elements: elements.length,
    requiredElements: elements.filter((e) => e.usage === 'required').length,
    codeLists: Object.keys(spec.codeLists || {}).length,
    rules: (spec.rules || []).length,
    rejectRules: (spec.rules || []).filter((r) => r.severity === 'reject').length,
    scenarios: (spec.scenarios || []).length,
    citedFraction: citable === 0 ? 0 : cited / citable
  };
}

export function segmentsByLoop(spec) {
  const groups = [];
  let current = null;
  for (const seg of spec.segments || []) {
    const key = seg.loopId || seg.level || 'body';
    if (!current || current.key !== key) {
      current = { key, loopId: seg.loopId || null, level: seg.level || null, segments: [] };
      groups.push(current);
    }
    current.segments.push(seg);
  }
  return groups;
}

export function findSegment(spec, idOrPos) {
  const needle = String(idOrPos || '').toUpperCase();
  return (spec.segments || []).find(
    (s) => String(s.id).toUpperCase() === needle || String(s.pos) === String(idOrPos)
  ) || null;
}

export function usageLabel(usage) {
  return {
    required: 'Required',
    conditional: 'Conditional',
    optional: 'Optional',
    notUsed: 'Not used'
  }[usage] || usage || '';
}

/**
 * Markdown rendering of a guide. This is the agent-facing format that matters most
 * in practice: it drops into a context window, it is diffable, and unlike the page
 * it carries no chrome. Deliberately dense.
 */
export function specToMarkdown(spec, { baseUrl = '', guidePath = '', version = null, attestation = null } = {}) {
  const g = spec.guide || {};
  const L = [];
  const cite = (c) => (c?.page ? ` [p.${c.page}]` : '');

  L.push(`# ${g.title}`);
  L.push('');
  L.push(`${g.hub?.name} requires this of its trading partners. ${DIRECTIONS[g.direction] || g.direction}.`);
  L.push('');
  L.push(`- Standard: ${g.standard} ${g.version}, transaction set ${g.transactionSet}`);
  if (version != null) L.push(`- Guide version: ${version}`);
  if (attestation?.attested_by) {
    L.push(`- Attested by ${attestation.attested_by}${attestation.attested_role ? `, ${attestation.attested_role}` : ''}, ${attestation.attested_at ? new Date(attestation.attested_at).toISOString().slice(0, 10) : ''}`);
  }
  if (g.effectiveFrom) L.push(`- Effective from: ${g.effectiveFrom}`);
  if (baseUrl && guidePath) L.push(`- Canonical: ${baseUrl}${guidePath}`);
  L.push('');
  if (g.summary) {
    L.push(g.summary);
    L.push('');
  }

  const d = spec.delimiters || {};
  L.push('## Delimiters');
  L.push('');
  L.push(`Segment \`${d.segment}\`, element \`${d.element}\`, component \`${d.component}\`, repetition \`${d.repetition}\`.`);
  L.push('');

  for (const [key, label] of [['isa', 'ISA interchange'], ['gs', 'GS functional group'], ['st', 'ST transaction set']]) {
    const rows = spec.envelope?.[key] || [];
    if (!rows.length) continue;
    L.push(`## ${label}`);
    L.push('');
    L.push('| Element | Name | Usage | Value |');
    L.push('|---|---|---|---|');
    for (const r of rows) {
      L.push(`| ${r.ref} | ${r.name || ''} | ${usageLabel(r.usage)} | ${r.value ? `\`${r.value}\`` : (r.note || '')} |`);
    }
    L.push('');
  }

  L.push('## Segments');
  L.push('');
  for (const group of segmentsByLoop(spec)) {
    const heading = group.loopId ? `Loop ${group.loopId}` : (group.level ? `${group.level[0].toUpperCase()}${group.level.slice(1)}` : 'Body');
    L.push(`### ${heading}`);
    L.push('');
    for (const seg of group.segments) {
      L.push(`#### ${seg.pos ? `${seg.pos} ` : ''}${seg.id} ${seg.name || ''}`);
      L.push('');
      const bits = [usageLabel(seg.usage)];
      if (seg.maxUse) bits.push(`max use ${seg.maxUse}`);
      if (seg.loopId) bits.push(`loop ${seg.loopId}`);
      L.push(`${bits.filter(Boolean).join(', ')}${cite(seg.citation)}`);
      L.push('');
      if (seg.note) {
        L.push(seg.note);
        L.push('');
      }
      if ((seg.elements || []).length) {
        L.push('| Ref | Name | Type | Min/Max | Usage | Values | Note |');
        L.push('|---|---|---|---|---|---|---|');
        for (const el of seg.elements) {
          const values = (el.values || [])
            .map((v) => `\`${v.code}\`${v.description ? ` ${v.description}` : ''}`)
            .join('; ');
          const note = [el.note, cite(el.citation).trim()].filter(Boolean).join(' ');
          L.push(`| ${el.ref} | ${el.name || ''} | ${el.type || ''} | ${el.min ?? ''}/${el.max ?? ''} | ${usageLabel(el.usage)} | ${values} | ${note.replace(/\|/g, '\\|')} |`);
        }
        L.push('');
      }
    }
  }

  if (Object.keys(spec.codeLists || {}).length) {
    L.push('## Code lists');
    L.push('');
    for (const [ref, codes] of Object.entries(spec.codeLists)) {
      L.push(`### ${ref}`);
      L.push('');
      for (const c of codes) {
        L.push(`- \`${c.code}\` ${c.description || ''}${c.note ? ` (${c.note})` : ''}`);
      }
      L.push('');
    }
  }

  if ((spec.rules || []).length) {
    L.push('## Rules');
    L.push('');
    L.push('A rule marked **reject** means the hub rejects the transaction when it is broken.');
    L.push('');
    for (const r of spec.rules) {
      L.push(`### ${r.id} (${r.severity || 'info'})${cite(r.citation)}`);
      L.push('');
      L.push(r.statement);
      if (r.rationale) {
        L.push('');
        L.push(`Why: ${r.rationale}`);
      }
      if (r.appliesTo) {
        L.push('');
        L.push(`Applies to: \`${r.appliesTo}\``);
      }
      L.push('');
    }
  }

  if ((spec.scenarios || []).length) {
    L.push('## Scenarios the hub expects partners to support');
    L.push('');
    for (const s of spec.scenarios) {
      L.push(`### ${s.id}: ${s.name}`);
      L.push('');
      if (s.description) {
        L.push(s.description);
        L.push('');
      }
      if (s.requirement) {
        L.push(`Requirement: ${s.requirement}`);
        L.push('');
      }
    }
  }

  if ((spec.contacts || []).length) {
    L.push('## Contacts');
    L.push('');
    for (const c of spec.contacts) {
      L.push(`- ${c.role ? `${c.role}: ` : ''}${c.name || ''}${c.email ? ` <${c.email}>` : ''}${c.note ? `, ${c.note}` : ''}`);
    }
    L.push('');
  }

  return L.join('\n');
}
