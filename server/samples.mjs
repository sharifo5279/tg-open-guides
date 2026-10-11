/**
 * Generated conformant sample files.
 *
 * This is the first paid artifact that falls out of the spec rather than out of
 * labour: once a guide is structured, a conformant example per scenario is almost
 * free to produce, and it is the thing a partner's developer wants most after the
 * requirements themselves.
 *
 * Deliberate limits. The generator builds from what the guide states: required
 * segments, required elements, published code values, and the hub's own structural
 * rules. Where the guide does not say, it emits a visibly fake placeholder rather
 * than a plausible-looking value, so nobody mistakes a sample for a real transaction.
 * A sample is an illustration of the structure, not a certified file.
 */
import { findSegment } from './spec.mjs';

const PLACEHOLDER = {
  AN: (el) => `X${'X'.repeat(Math.max(0, Math.min(Number(el.min) || 2, 8) - 1))}`,
  ID: () => 'ZZ',
  DT: () => '20260415',
  TM: () => '1430',
  N0: () => '1',
  N2: () => '1.00',
  R: () => '1'
};

function firstCode(el) {
  return el.values?.[0]?.code ?? null;
}

function valueFor(el, overrides = {}) {
  if (overrides[el.ref] !== undefined) return overrides[el.ref];
  const code = firstCode(el);
  if (code) return code;
  const maker = PLACEHOLDER[String(el.type || 'AN').toUpperCase()] || PLACEHOLDER.AN;
  return maker(el);
}

/** Mod-10 check digit, so a generated SSCC is at least internally consistent. */
export function sscc18(serialBase) {
  const body = String(serialBase).replace(/\D/g, '').padStart(17, '0').slice(-17);
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += Number(body[i]) * (i % 2 === 0 ? 3 : 1);
  }
  const check = (10 - (sum % 10)) % 10;
  return body + String(check);
}

function buildSegment(spec, seg, overrides = {}, delims) {
  const els = seg.elements || [];
  if (!els.length) return null;
  // Element positions come from the ref suffix (BSN02 -> 2), so a guide that
  // documents only BSN01 and BSN05 still produces correctly positioned output.
  const slots = [];
  for (const el of els) {
    if (el.usage === 'notUsed') continue;
    const m = String(el.ref).match(/(\d{2})$/);
    const pos = m ? Number(m[1]) : slots.length + 1;
    if (el.usage !== 'required' && overrides[el.ref] === undefined) continue;
    slots[pos] = valueFor(el, overrides);
  }
  const maxPos = slots.reduce((a, _v, i) => Math.max(a, i), 0);
  const out = [];
  for (let i = 1; i <= maxPos; i++) out.push(slots[i] ?? '');
  if (!out.length) return null;
  return [seg.id, ...out].join(delims.element).replace(/\*+$/, '');
}

/**
 * The 856 hierarchy is the case worth generating properly, because the hierarchy is
 * where new suppliers actually fail. Other transaction sets get a flat required-segment
 * skeleton, which is honest about being a skeleton.
 */
function build856(spec, scenario, delims) {
  const lines = [];
  const seg = (id, loop) =>
    (spec.segments || []).find(
      (s) => s.id === id && (loop === undefined || String(s.loopId || '') === loop)
    );
  const push = (s, overrides) => {
    if (!s) return;
    const line = buildSegment(spec, s, overrides, delims);
    if (line) lines.push(line);
  };

  const shipmentId = `SHP${scenario.n}0001`;
  const orders = scenario.orders || 1;
  const cartonsPerOrder = scenario.cartonsPerOrder || 1;
  const itemsPerCarton = scenario.itemsPerCarton || 1;

  push(seg('ST'), { ST01: '856', ST02: '0001' });
  push(seg('BSN'), {
    BSN01: scenario.cancel ? '01' : '00',
    BSN02: shipmentId,
    BSN03: '20260415',
    BSN04: '1430',
    BSN05: '0001'
  });
  push(seg('DTM'), { DTM01: '011', DTM02: '20260415', DTM03: '1400' });

  let hl = 1;
  const shipmentHl = hl;
  push(seg('HL', 'HL-S'), { HL01: String(hl), HL03: 'S', HL04: '1' });
  const totalCartons = orders * cartonsPerOrder;
  push(seg('TD1', 'HL-S'), {
    TD101: 'CTN25',
    TD102: String(totalCartons),
    TD106: 'G',
    TD107: String(totalCartons * 18),
    TD108: 'LB'
  });
  push(seg('TD5', 'HL-S'), {
    TD501: 'B',
    TD502: '2',
    TD503: scenario.ownTruck ? 'SUPP' : 'RDWY',
    TD504: scenario.ownTruck ? 'SR' : 'M'
  });
  if (!scenario.ltl) {
    push(seg('TD3', 'HL-S'), { TD301: 'TL', TD303: `TRL${scenario.n}001` });
  }
  push(seg('REF', 'HL-S'), { REF01: 'BM', REF02: `BOL${scenario.n}0001` });
  if (scenario.ltl) {
    push(seg('REF', 'HL-S'), { REF01: 'CN', REF02: `PRO${scenario.n}0001` });
  }
  push(seg('N1', 'HL-S/N1'), { N101: 'ST', N102: 'CRESTFIELD DC12', N103: '92', N104: 'DC12' });
  push(seg('N1', 'HL-S/N1'), { N101: 'SF', N102: 'YOUR COMPANY NAME', N103: '01', N104: '123456789' });

  for (let o = 0; o < orders; o++) {
    hl += 1;
    const orderHl = hl;
    push(seg('HL', 'HL-O'), { HL01: String(hl), HL02: String(shipmentHl), HL03: 'O', HL04: '1' });
    push(seg('PRF', 'HL-O'), { PRF01: String(4500000000 + o).padStart(10, '0'), PRF04: '20260401' });

    for (let c = 0; c < cartonsPerOrder; c++) {
      hl += 1;
      const packHl = hl;
      push(seg('HL', 'HL-P'), { HL01: String(hl), HL02: String(orderHl), HL03: 'P', HL04: '1' });
      push(seg('MAN', 'HL-P'), {
        MAN01: 'GM',
        MAN02: sscc18(`0012345670000${o}${c}${scenario.n}`)
      });

      for (let i = 0; i < itemsPerCarton; i++) {
        hl += 1;
        push(seg('HL', 'HL-I'), { HL01: String(hl), HL02: String(packHl), HL03: 'I' });
        push(seg('LIN', 'HL-I'), {
          LIN02: 'UP',
          LIN03: String(12345678901 + i).padStart(12, '0'),
          LIN04: 'BP',
          LIN05: `CF-ITEM-${1000 + i}`
        });
        push(seg('SN1', 'HL-I'), { SN102: '12', SN103: 'EA' });
      }
    }
  }

  push(seg('CTT'), { CTT01: String(hl) });
  push(seg('SE'), { SE01: String(lines.length + 1), SE02: '0001' });
  return lines;
}

function buildGeneric(spec, delims) {
  const lines = [];
  for (const seg of spec.segments || []) {
    if (seg.usage !== 'required') continue;
    const line = buildSegment(spec, seg, {}, delims);
    if (line) lines.push(line);
  }
  return lines;
}

const SCENARIO_SHAPES = {
  'S-1': { n: 1, orders: 1, cartonsPerOrder: 2, itemsPerCarton: 1 },
  'S-2': { n: 2, orders: 3, cartonsPerOrder: 1, itemsPerCarton: 1 },
  'S-3': { n: 3, orders: 1, cartonsPerOrder: 1, itemsPerCarton: 4 },
  'S-4': { n: 4, orders: 1, cartonsPerOrder: 1, itemsPerCarton: 1, cancel: true },
  'S-5': { n: 5, orders: 1, cartonsPerOrder: 1, itemsPerCarton: 1, ownTruck: true }
};

export function generateSamples(spec) {
  const delims = { element: '*', segment: '~', ...(spec.delimiters || {}) };
  const is856 = String(spec.guide?.transactionSet) === '856';
  const out = [];

  const scenarios = (spec.scenarios || []).length
    ? spec.scenarios
    : [{ id: 'S-1', name: 'Required segments only', requirement: 'Structure skeleton.' }];

  for (const sc of scenarios) {
    const shape = SCENARIO_SHAPES[sc.id] || { n: out.length + 1, orders: 1, cartonsPerOrder: 1, itemsPerCarton: 1 };
    const lines = is856 ? build856(spec, shape, delims) : buildGeneric(spec, delims);
    if (!lines.length) continue;
    out.push({
      id: sc.id,
      name: sc.name,
      requirement: sc.requirement || sc.description || '',
      edi: lines.map((l) => l + delims.segment).join('\n'),
      segmentCount: lines.length
    });
  }
  return out;
}

export function samplesReadme(spec, samples) {
  const g = spec.guide || {};
  return [
    `# Sample files: ${g.hub?.name}, ${g.standard} ${g.transactionSet} ${g.version}`,
    '',
    'Generated from the published guide. Each file illustrates the structure for one',
    'scenario the hub expects a partner to handle.',
    '',
    '## Read this before using them',
    '',
    '- These are illustrations of structure, not certified transactions. Passing a',
    '  structural comparison against a sample does not mean the hub will accept your file.',
    '- Identifiers, names, item numbers and SSCCs are invented. The SSCC check digits are',
    '  arithmetically valid so the format is right, but the numbers belong to nobody.',
    '- Where the guide does not state a value, the generator emits a visible placeholder',
    '  rather than a plausible one, so you can find what you still need to ask the hub.',
    '- The envelope (ISA and GS) is not generated, because its values are specific to your',
    '  trading relationship. Take those from the envelope section of the guide.',
    '',
    '## Files',
    '',
    ...samples.map((s) => `- \`${s.id}.edi\` (${s.segmentCount} segments): ${s.name}. ${s.requirement}`),
    ''
  ].join('\n');
}
