/**
 * Composes a hub profile plus a transaction set skeleton into a guide spec.
 *
 * Page citations are assigned by walking the document the way a real guide is
 * laid out: front matter, envelope, then segments in area order, then rules and
 * scenarios. The numbers are synthetic because the source documents are
 * fictional, but they are internally consistent, which is what matters: a
 * reviewer checking two claims about the same segment lands on the same page.
 */
import { SEGMENTS } from './segments.mjs';
import { TRANSACTIONS, LOOP_META, EXTRA_SEGMENTS } from './transactions.mjs';

const ALL_SEGMENTS = { ...SEGMENTS, ...EXTRA_SEGMENTS };

function clone(v) {
  return v == null ? v : JSON.parse(JSON.stringify(v));
}

/** Front matter runs for a few pages before the envelope in every real guide. */
function pager(totalPages) {
  let page = 4;
  const cap = Math.max(totalPages - 4, 10);
  return {
    current: () => page,
    next(step = 1) {
      const p = page;
      page = Math.min(page + step, cap);
      return p;
    }
  };
}

function overrideFor(map, ...keys) {
  if (!map) return null;
  for (const k of keys) {
    if (k && map[k]) return map[k];
  }
  return null;
}

/**
 * A document the partner sends is a set of requirements placed on them; one the
 * hub sends is a specification of what will arrive. Calling both "supplier
 * requirements" is wrong in one direction and wrong again for a hub whose
 * partners are carriers.
 */
function defaultTitle(ts, cfg, hub) {
  const direction = cfg.direction || ts.direction;
  const term = cfg.partnerTerm || hub.partnerTerm || 'partner';
  return direction === 'partner_sends'
    ? `${ts.title} ${term} requirements`
    : `${ts.title} specification`;
}

export function composeGuide(hub, tsCode) {
  const ts = TRANSACTIONS[tsCode];
  const cfg = hub.sets[tsCode];
  if (!ts || !cfg) throw new Error(`no transaction ${tsCode} for hub ${hub.slug}`);

  const pg = pager(hub.pages);
  const spec = {
    specVersion: 'og/1',
    guide: {
      hub: { name: hub.name, slug: hub.slug, legalName: hub.legalName, industry: hub.industry },
      title: cfg.title || defaultTitle(ts, cfg, hub),
      standard: 'X12',
      transactionSet: tsCode,
      version: hub.stdVersion,
      direction: cfg.direction || ts.direction,
      summary: cfg.summary,
      effectiveFrom: hub.effectiveFrom,
      authoredBy: 'OpenText Professional Services on behalf of the hub',
      supersedes: hub.sourceDoc,
      attestation: {
        name: hub.attestor.name,
        role: hub.attestor.role,
        // Attested shortly before the requirements took effect, as a hub would.
        date: new Date(new Date(hub.effectiveFrom).getTime() - 12 * 86400000).toISOString().slice(0, 10)
      },
      sourcePages: hub.pages
    },
    delimiters: { ...hub.delimiters },
    loops: {},
    envelope: { isa: [], gs: [], st: [] },
    segments: [],
    codeLists: {},
    rules: [],
    scenarios: [],
    contacts: clone(hub.contacts)
  };

  /* ------------------------------------------------------------ envelope */
  const envPage = pg.next();
  const env = hub.envelope;
  spec.envelope.isa = [
    { ref: 'ISA05', name: 'Interchange ID Qualifier (sender)', usage: 'required', value: env.qualifier, note: env.senderNote, citation: { page: envPage } },
    { ref: 'ISA06', name: 'Interchange Sender ID', usage: 'required', value: null, note: 'Left justified, space filled to 15 characters.', citation: { page: envPage } },
    { ref: 'ISA07', name: 'Interchange ID Qualifier (receiver)', usage: 'required', value: env.qualifier, note: null, citation: { page: envPage } },
    { ref: 'ISA08', name: 'Interchange Receiver ID', usage: 'required', value: env.receiverId, note: `${hub.name} identifier. The same value for all locations; the destination is identified inside the transaction.`, citation: { page: envPage } },
    { ref: 'ISA12', name: 'Interchange Control Version Number', usage: 'required', value: hub.stdVersion === '005010' ? '00501' : '00401', note: null, citation: { page: envPage } },
    { ref: 'ISA14', name: 'Acknowledgment Requested', usage: 'required', value: env.ackRequested, note: `${hub.name} returns a 997 for every interchange.`, citation: { page: envPage } },
    { ref: 'ISA15', name: 'Usage Indicator', usage: 'required', value: null, note: env.usageNote, citation: { page: envPage } }
  ];
  if (hub.stdVersion === '004010') {
    spec.envelope.isa.splice(4, 0, { ref: 'ISA11', name: 'Interchange Control Standards Identifier', usage: 'required', value: 'U', note: null, citation: { page: envPage } });
  }

  const gsPage = pg.next();
  spec.envelope.gs = [
    { ref: 'GS01', name: 'Functional Identifier Code', usage: 'required', value: ts.functionalId, note: null, citation: { page: gsPage } },
    { ref: 'GS02', name: "Application Sender's Code", usage: 'required', value: null, note: 'Same identifier as ISA06.', citation: { page: gsPage } },
    { ref: 'GS03', name: "Application Receiver's Code", usage: 'required', value: env.appReceiverCode, note: null, citation: { page: gsPage } },
    { ref: 'GS07', name: 'Responsible Agency Code', usage: 'required', value: 'X', note: null, citation: { page: gsPage } },
    { ref: 'GS08', name: 'Version / Release / Industry Identifier Code', usage: 'required', value: hub.stdVersion, note: `${hub.stdVersion} only. ${hub.name} does not translate other versions on this transaction.`, citation: { page: gsPage } }
  ];
  spec.envelope.st = [
    { ref: 'ST01', name: 'Transaction Set Identifier Code', usage: 'required', value: tsCode, note: null, citation: { page: gsPage } },
    { ref: 'ST02', name: 'Transaction Set Control Number', usage: 'required', value: null, note: 'Unique within the functional group, and must equal SE02.', citation: { page: gsPage } }
  ];

  /* ------------------------------------------------------------ segments */
  const loopsSeen = new Set();
  const areaOrder = { header: 0, detail: 1, summary: 2 };
  const ordered = [...ts.segments].sort((a, b) => areaOrder[a.level] - areaOrder[b.level]);

  for (const slot of ordered) {
    const def = ALL_SEGMENTS[slot.key];
    const segId = def.id || slot.key;
    const page = pg.next();

    const segOverride = overrideFor(cfg.segments, `${segId}@${slot.loopId}`, segId, slot.key);
    const seg = {
      pos: slot.pos,
      id: segId,
      name: def.name,
      level: slot.level,
      loopId: slot.loopId,
      usage: segOverride?.usage || slot.usage,
      maxUse: segOverride?.maxUse ?? slot.maxUse,
      note: segOverride?.note || null,
      citation: { page },
      elements: []
    };

    for (const el of def.elements) {
      const elOverride = overrideFor(cfg.elements, `${el.ref}@${slot.loopId}`, `${el.ref}@${segId}`, el.ref);
      const values = elOverride?.values ? clone(elOverride.values) : clone(el.values);
      seg.elements.push({
        ref: el.ref,
        id: el.id,
        name: el.name,
        type: el.type,
        min: el.min,
        max: el.max,
        usage: elOverride?.usage || el.usage,
        values: values || [],
        note: elOverride?.note ?? el.note ?? null,
        citation: { page }
      });
      // A code list the hub restricted is worth surfacing on its own.
      if (elOverride?.values?.length) {
        spec.codeLists[el.ref] = clone(elOverride.values);
      }
    }

    spec.segments.push(seg);

    if (slot.loopId && !loopsSeen.has(slot.loopId)) {
      loopsSeen.add(slot.loopId);
      const meta = LOOP_META[slot.loopId] || {};
      spec.loops[slot.loopId] = {
        name: meta.name || slot.loopId,
        usage: slot.usage,
        repeat: meta.repeat ?? null,
        parent: slot.loopId.includes('/') ? slot.loopId.split('/')[0] : null,
        note: null,
        citation: { page }
      };
    }
  }

  /* --------------------------------------------------------------- rules */
  const allRules = [...(cfg.rules || []), ...(hub.commonRules || [])];
  spec.rules = allRules.map((r, i) => ({
    id: `R-${String(i + 1).padStart(3, '0')}`,
    severity: r.severity,
    statement: r.statement,
    rationale: r.rationale,
    appliesTo: r.appliesTo,
    citation: { page: pg.next() }
  }));

  /* ----------------------------------------------------------- scenarios */
  spec.scenarios = (cfg.scenarios || []).map((s, i) => ({
    id: `S-${i + 1}`,
    name: s.name,
    description: s.description,
    requirement: s.requirement,
    citation: { page: pg.next() }
  }));

  return spec;
}

export function guideSlug(tsCode, stdVersion) {
  return `${tsCode.toLowerCase()}-${String(stdVersion).toLowerCase()}`;
}
