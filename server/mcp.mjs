/**
 * MCP endpoint.
 *
 * Tool design follows one rule: each tool returns something that fits comfortably in
 * a context window and answers a question an integrator actually asks. There is no
 * generic "query the database" tool, and no tool that returns the whole guide unless
 * the caller explicitly asks for it.
 *
 * The other rule is a boundary, repeated in every description because a model will
 * otherwise assume it: this service publishes requirements and never validates or
 * certifies a file.
 *
 * Stateless: a fresh server and transport per request, so no state is shared between
 * callers.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { listGuides, getGuide, getVersion } from './store.mjs';
import { specToMarkdown, specStats, DIRECTIONS, usageLabel } from './spec.mjs';

const BOUNDARY =
  'Publishes the hub’s stated requirements only. It does not validate, test or certify a file you have built, and it cannot tell you whether the hub will accept your transaction.';

async function resolveGuide({ hub, transactionSet, guide }) {
  if (guide && guide.includes('/')) {
    const [hubSlug, slug] = guide.split('/');
    const g = await getGuide(hubSlug, slug);
    if (g) return g;
  }
  const all = await listGuides({ includeUnlisted: false });
  const wantHub = String(hub || '').toLowerCase();
  const wantTs = String(transactionSet || '').trim();
  const matches = all.filter((g) => {
    const hubOk = !wantHub ||
      g.hub_slug.toLowerCase() === wantHub ||
      g.hub_name.toLowerCase().includes(wantHub);
    const tsOk = !wantTs || g.transaction_set === wantTs;
    return hubOk && tsOk;
  });
  if (matches.length === 1) {
    return getGuide(matches[0].hub_slug, matches[0].slug);
  }
  if (matches.length > 1) {
    const err = new Error(
      `More than one guide matches. Narrow it with the exact reference: ${matches
        .map((m) => `${m.hub_slug}/${m.slug}`)
        .join(', ')}`
    );
    err.ambiguous = true;
    throw err;
  }
  return null;
}

function textResult(text) {
  return { content: [{ type: 'text', text }] };
}

function notFound(args) {
  return textResult(
    `No published guide matches ${JSON.stringify(args)}. Use search_guides with no arguments to list everything available.`
  );
}

function buildServer({ baseUrl }) {
  const server = new McpServer(
    { name: 'tg-open-guides', version: '0.1.0' },
    {
      instructions:
        'Trading Grid Open Guides serves EDI implementation guides published and attested by the buyer hub that owns them. Use it to learn what a specific hub requires, which is information the X12 or EDIFACT standard does not contain. Start with get_guide_summary, then get_rules for what causes a rejection, then get_segment for structure. ' +
        BOUNDARY
    }
  );

  server.registerTool(
    'search_guides',
    {
      title: 'Search published guides',
      description:
        'List or filter the published guides: which hubs have published requirements, for which transaction sets. Call with no arguments to see everything. ' +
        BOUNDARY,
      inputSchema: {
        hub: z.string().optional().describe('Hub name or slug, partial match, for example "crestfield"'),
        transactionSet: z.string().optional().describe('Transaction set code, for example "856"'),
        standard: z.string().optional().describe('"X12" or "EDIFACT"')
      }
    },
    async ({ hub, transactionSet, standard }) => {
      const all = await listGuides({ includeUnlisted: false });
      const rows = all.filter((g) => {
        const h = !hub || g.hub_slug.toLowerCase().includes(hub.toLowerCase()) || g.hub_name.toLowerCase().includes(hub.toLowerCase());
        const t = !transactionSet || g.transaction_set === String(transactionSet).trim();
        const s = !standard || g.standard.toLowerCase() === standard.toLowerCase();
        return h && t && s;
      });
      if (!rows.length) {
        const hubs = [...new Set(all.map((g) => g.hub_slug))].join(', ');
        return textResult(`No published guide matches that filter. Hubs available: ${hubs}.`);
      }

      const LIMIT = 25;
      if (rows.length > LIMIT && !hub && !transactionSet) {
        // Unfiltered and large: an index of the catalogue is more useful than a
        // truncated list, and it tells the caller how to narrow the search.
        const byHub = new Map();
        for (const g of rows) {
          if (!byHub.has(g.hub_slug)) byHub.set(g.hub_slug, { name: g.hub_name, sets: [] });
          byHub.get(g.hub_slug).sets.push(g.transaction_set);
        }
        return textResult(
          `${rows.length} published guides across ${byHub.size} hubs. Narrow with "hub" or "transactionSet", then call get_guide_summary.\n\n` +
            [...byHub.entries()]
              .map(([slug, h]) => `- ${slug} (${h.name}): ${h.sets.sort().join(', ')}`)
              .join('\n')
        );
      }

      const shown = rows.slice(0, LIMIT);
      const lines = shown.map(
        (g) =>
          `- ${g.hub_slug}/${g.slug}: ${g.hub_name}, ${g.standard} ${g.std_version} ${g.transaction_set}. ${DIRECTIONS[g.direction] || g.direction}. v${g.cur_version}${g.attested_by ? `, attested by ${g.attested_by}` : ', not attested'}. Page: ${baseUrl}/g/${g.hub_slug}/${g.slug}`
      );
      return textResult(
        `${rows.length} published guide(s)${rows.length > LIMIT ? `, showing the first ${LIMIT}` : ''}. Pass the reference before the colon as the "guide" argument to the other tools.\n\n${lines.join('\n')}`
      );
    }
  );

  server.registerTool(
    'get_guide_summary',
    {
      title: 'Get a guide summary',
      description:
        'The short version of one hub’s requirements: what the guide covers, which segments and elements are mandatory, how many rules cause a rejection, and which scenarios the hub expects a partner to handle. Start here before fetching structure. ' +
        BOUNDARY,
      inputSchema: {
        guide: z.string().optional().describe('Exact reference such as "crestfield/856-004010"'),
        hub: z.string().optional().describe('Hub name or slug, if you do not have the exact reference'),
        transactionSet: z.string().optional().describe('Transaction set code, for example "856"')
      }
    },
    async (args) => {
      const g = await resolveGuide(args);
      if (!g) return notFound(args);
      const v = await getVersion(g.id);
      if (!v) return textResult(`${g.hub_name} has no published version of this guide.`);
      const spec = v.spec;
      const stats = specStats(spec);
      const required = (spec.segments || [])
        .filter((s) => s.usage === 'required')
        .map((s) => `${s.id}${s.loopId ? ` (${s.loopId})` : ''}`);
      const rejects = (spec.rules || []).filter((r) => r.severity === 'reject');
      return textResult(
        [
          `# ${spec.guide.title}`,
          `Hub: ${spec.guide.hub.name}. ${DIRECTIONS[spec.guide.direction] || spec.guide.direction}.`,
          `Standard: ${spec.guide.standard} ${spec.guide.version}, transaction set ${spec.guide.transactionSet}.`,
          `Guide version ${v.version}${v.attested_by ? `, attested by ${v.attested_by}${v.attested_role ? ` (${v.attested_role})` : ''} on ${String(v.attested_at).slice(0, 10)}` : ', NOT ATTESTED, treat as draft'}.`,
          spec.guide.effectiveFrom ? `Effective from ${spec.guide.effectiveFrom}.` : '',
          '',
          spec.guide.summary || '',
          '',
          `## Scale`,
          `${stats.segments} segments (${stats.requiredSegments} required), ${stats.elements} elements (${stats.requiredElements} required), ${stats.rules} rules of which ${stats.rejectRules} cause a rejection, ${stats.scenarios} expected scenarios.`,
          '',
          `## Required segments`,
          required.join(', ') || 'none',
          '',
          `## Rules that cause a rejection`,
          rejects.map((r) => `- ${r.id}: ${r.statement}`).join('\n') || 'none',
          '',
          `## Scenarios the hub expects`,
          (spec.scenarios || []).map((s) => `- ${s.id} ${s.name}: ${s.requirement || s.description || ''}`).join('\n') || 'none stated',
          '',
          `Next: get_rules for the full rule set, get_segment for one segment's elements, get_guide_markdown for everything.`,
          `Canonical page: ${baseUrl}/g/${g.hub_slug}/${g.slug}`
        ]
          .filter((l) => l !== '')
          .join('\n')
      );
    }
  );

  server.registerTool(
    'get_rules',
    {
      title: 'Get a guide’s rules',
      description:
        'The hub’s enforced rules, each with the reason behind it and the source page it was compiled from. Filter to severity "reject" for the ones that cause a transaction to be refused. This is where most first-submission failures come from, so read it before writing structure. ' +
        BOUNDARY,
      inputSchema: {
        guide: z.string().optional().describe('Exact reference such as "crestfield/856-004010"'),
        hub: z.string().optional(),
        transactionSet: z.string().optional(),
        severity: z.enum(['reject', 'warn', 'info']).optional().describe('Return only rules of this severity')
      }
    },
    async (args) => {
      const g = await resolveGuide(args);
      if (!g) return notFound(args);
      const v = await getVersion(g.id);
      if (!v) return textResult(`${g.hub_name} has no published version of this guide.`);
      const rules = (v.spec.rules || []).filter((r) => !args.severity || r.severity === args.severity);
      if (!rules.length) return textResult('No rules match that filter.');
      return textResult(
        `${rules.length} rule(s) for ${v.spec.guide.hub.name} ${v.spec.guide.transactionSet}, guide version ${v.version}.\n\n` +
          rules
            .map((r) =>
              [
                `## ${r.id} [${r.severity}]${r.appliesTo ? ` applies to ${r.appliesTo}` : ''}${r.citation?.page ? ` (source page ${r.citation.page})` : ''}`,
                r.statement,
                r.rationale ? `Reason: ${r.rationale}` : ''
              ]
                .filter(Boolean)
                .join('\n')
            )
            .join('\n\n')
      );
    }
  );

  server.registerTool(
    'get_segment',
    {
      title: 'Get one segment',
      description:
        'One segment of a guide with its elements, lengths, usage, accepted code values and the hub’s notes. Use this rather than fetching the whole guide when you are building or checking a specific segment. ' +
        BOUNDARY,
      inputSchema: {
        segment: z.string().describe('Segment id such as "MAN", "BSN", "HL", or a position such as "0200"'),
        guide: z.string().optional().describe('Exact reference such as "crestfield/856-004010"'),
        hub: z.string().optional(),
        transactionSet: z.string().optional(),
        loop: z.string().optional().describe('Loop id when a segment appears in more than one loop, for example "HL-P"')
      }
    },
    async (args) => {
      const g = await resolveGuide(args);
      if (!g) return notFound(args);
      const v = await getVersion(g.id);
      if (!v) return textResult(`${g.hub_name} has no published version of this guide.`);

      const needle = String(args.segment).toUpperCase();
      let hits = (v.spec.segments || []).filter(
        (s) => String(s.id).toUpperCase() === needle || String(s.pos) === String(args.segment)
      );
      if (args.loop) hits = hits.filter((s) => String(s.loopId || '').toUpperCase() === String(args.loop).toUpperCase());
      if (!hits.length) {
        const available = [...new Set((v.spec.segments || []).map((s) => s.id))].join(', ');
        return textResult(`No segment "${args.segment}" in this guide. Segments present: ${available}`);
      }
      if (hits.length > 1 && !args.loop) {
        const loops = hits.map((s) => s.loopId || s.level).join(', ');
        return textResult(
          `"${needle}" appears ${hits.length} times, in: ${loops}. Pass the "loop" argument to pick one, or read them all below.\n\n` +
            hits.map(renderSegmentText).join('\n\n')
        );
      }
      return textResult(hits.map(renderSegmentText).join('\n\n'));
    }
  );

  server.registerTool(
    'get_code_list',
    {
      title: 'Get accepted codes for an element',
      description:
        'The values a hub accepts for one element. A code that is valid in the standard but absent from this list is not accepted by the hub, which is the most common silent cause of a rejected transaction. ' +
        BOUNDARY,
      inputSchema: {
        element: z.string().describe('Element reference such as "HL03", "MAN01", "REF01"'),
        guide: z.string().optional(),
        hub: z.string().optional(),
        transactionSet: z.string().optional()
      }
    },
    async (args) => {
      const g = await resolveGuide(args);
      if (!g) return notFound(args);
      const v = await getVersion(g.id);
      if (!v) return textResult(`${g.hub_name} has no published version of this guide.`);

      const ref = String(args.element).toUpperCase();
      const fromList = (v.spec.codeLists || {})[ref];
      const fromElement = (v.spec.segments || [])
        .flatMap((s) => s.elements || [])
        .find((e) => String(e.ref).toUpperCase() === ref);
      const codes = fromList || fromElement?.values;
      if (!codes?.length) {
        const have = Object.keys(v.spec.codeLists || {}).join(', ');
        return textResult(
          `No code list published for ${ref}.${have ? ` Published code lists: ${have}.` : ''} An element with no published list accepts the standard's values, but confirm with the hub before relying on that.`
        );
      }
      return textResult(
        `Accepted values for ${ref} at ${v.spec.guide.hub.name} (${v.spec.guide.transactionSet}, guide v${v.version}). Values outside this list are not accepted.\n\n` +
          codes.map((c) => `- ${c.code}: ${c.description || ''}${c.note ? ` (${c.note})` : ''}`).join('\n')
      );
    }
  );

  server.registerTool(
    'get_guide_markdown',
    {
      title: 'Get the whole guide',
      description:
        'The complete guide as Markdown: envelope, every segment and element, code lists, rules and scenarios. This is a large payload, so prefer get_guide_summary, get_rules and get_segment unless you want the whole document in context. ' +
        BOUNDARY,
      inputSchema: {
        guide: z.string().optional(),
        hub: z.string().optional(),
        transactionSet: z.string().optional()
      }
    },
    async (args) => {
      const g = await resolveGuide(args);
      if (!g) return notFound(args);
      const v = await getVersion(g.id);
      if (!v) return textResult(`${g.hub_name} has no published version of this guide.`);
      return textResult(
        specToMarkdown(v.spec, {
          baseUrl,
          guidePath: `/g/${g.hub_slug}/${g.slug}`,
          version: v.version,
          attestation: v
        })
      );
    }
  );

  return server;
}

function renderSegmentText(seg) {
  const L = [];
  L.push(`## ${seg.id} ${seg.name || ''}${seg.loopId ? ` [loop ${seg.loopId}]` : ''}`);
  L.push(
    `${usageLabel(seg.usage)}${seg.maxUse ? `, max use ${seg.maxUse}` : ''}${seg.pos ? `, position ${seg.pos}` : ''}${seg.citation?.page ? `, source page ${seg.citation.page}` : ''}`
  );
  if (seg.note) L.push(`Hub note: ${seg.note}`);
  for (const el of seg.elements || []) {
    const vals = (el.values || [])
      .map((v) => `${v.code}${v.description ? `=${v.description}` : ''}${v.note ? ` (${v.note})` : ''}`)
      .join('; ');
    L.push(
      `- ${el.ref} ${el.name || ''} | ${el.type || ''} ${el.min ?? ''}/${el.max ?? ''} | ${usageLabel(el.usage)}${vals ? ` | values: ${vals}` : ''}${el.note ? ` | ${el.note}` : ''}${el.citation?.page ? ` | p.${el.citation.page}` : ''}`
    );
  }
  return L.join('\n');
}

export async function handleMcpRequest(req, res, { baseUrl }) {
  const server = buildServer({ baseUrl });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[mcp] request failed:', err.message);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null
      });
    }
  }
}
