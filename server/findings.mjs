/**
 * Findings: every item a compile produces, with a stable ID and a review state.
 *
 * A finding ID (F-001, F-002, ...) is assigned once and stays on the item
 * through edits, so a reviewer can refer to it, return to it later and link to
 * it. Review state lives on the item too, so a draft can be left and resumed.
 * Dropping is reversible until publication, which is when dropped items leave
 * the spec.
 */
import { normalizeSpec } from './spec.mjs';

export const REVIEW_STATES = ['open', 'confirmed', 'edited', 'dropped'];

const ENVELOPE_GROUPS = ['isa', 'gs', 'st'];

/** Flat list of findings in document order. */
export function listFindings(spec) {
  const out = [];
  for (const group of ENVELOPE_GROUPS) {
    for (const row of spec.envelope?.[group] || []) {
      out.push({ kind: 'envelope', group, ref: row.ref, item: row });
    }
  }
  for (const seg of spec.segments || []) {
    out.push({ kind: 'segment', ref: `${seg.id}${seg.pos ? ` ${seg.pos}` : ''}`, item: seg });
    for (const el of seg.elements || []) {
      out.push({ kind: 'element', ref: el.ref, item: el, parent: seg });
    }
  }
  for (const rule of spec.rules || []) out.push({ kind: 'rule', ref: rule.id, item: rule });
  for (const s of spec.scenarios || []) out.push({ kind: 'scenario', ref: s.id, item: s });
  return out;
}

/** Assign IDs to findings that lack one. Returns true when anything changed. */
export function assignFindingIds(spec) {
  let seq = Number.isInteger(spec.findingSeq) ? spec.findingSeq : 0;
  let changed = false;
  for (const f of listFindings(spec)) {
    if (f.item.fid) continue;
    seq += 1;
    f.item.fid = `F-${String(seq).padStart(3, '0')}`;
    changed = true;
  }
  if (seq !== spec.findingSeq) {
    spec.findingSeq = seq;
    changed = true;
  }
  return changed;
}

/** The state a finding is in: explicit review state, else derived from the compiler. */
export function findingState(item) {
  if (item.review?.state && REVIEW_STATES.includes(item.review.state)) return item.review.state;
  return item.confidence === 'high' && item.citation?.page ? 'confirmed' : 'open';
}

export function findingsSummary(spec) {
  const counts = { open: 0, confirmed: 0, edited: 0, dropped: 0, total: 0 };
  for (const f of listFindings(spec)) {
    counts[findingState(f.item)] += 1;
    counts.total += 1;
  }
  counts.reviewed = counts.confirmed + counts.edited + counts.dropped;
  return counts;
}

export function findByFid(spec, fid) {
  return listFindings(spec).find((f) => f.item.fid === fid) || null;
}

/** Prepare an import's spec for review: one entry per segment, every finding identified. */
export function prepareForReview(spec) {
  const normalised = normalizeSpec(spec);
  const changed = normalised !== spec;
  const assigned = assignFindingIds(normalised);
  return { spec: normalised, changed: changed || assigned };
}

/** The spec as it publishes: dropped findings removed, review bookkeeping kept. */
export function publishableSpec(spec) {
  const keep = (it) => findingState(it) !== 'dropped';
  const out = { ...spec };
  out.envelope = {};
  for (const group of ENVELOPE_GROUPS) out.envelope[group] = (spec.envelope?.[group] || []).filter(keep);
  out.segments = (spec.segments || []).filter(keep).map((seg) => ({ ...seg, elements: (seg.elements || []).filter(keep) }));
  out.rules = (spec.rules || []).filter(keep);
  out.scenarios = (spec.scenarios || []).filter(keep);
  return out;
}
