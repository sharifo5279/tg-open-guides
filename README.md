# Trading Grid Open Guides

Hub-attested EDI implementation guides that partners' people and AI agents can both read.

Incubation prototype. Not a shipping OpenText product. All guide content in this
repository is fictional sample data.

## What problem this solves

A buyer hub's EDI implementation guide is a PDF behind a portal login. A supplier's
developer reads it by hand, and a supplier's AI agent cannot read it at all. Agents
know X12; they do not know any particular hub's requirements. So every new partner
relationship starts with a human translating a PDF, then a test cycle to find out
what the translation got wrong.

Open Guides publishes the same requirements as a structured, versioned, hub-attested
contract with three faces:

1. **Guide Builder** turns a PDF implementation guide into a structured draft, every
   rule carrying a citation back to its source page, for the hub to correct and attest.
2. **Public Guides** renders the attested guide as a readable, versioned web page the
   hub can share by link.
3. **The agent connection** serves the same guide as JSON, Markdown, `llms.txt` and an
   MCP endpoint, so a partner's agent reads the hub's actual requirements.

What it deliberately does not do: accept a partner's test file, certify a partner,
generate maps, or provision connectivity. Those belong to the onboarding and
certification products, and Open Guides is the requirements record they read from.

## Product boundary

- **Open Guides** publishes and explains requirements. It never judges a partner's file.
- **Onboarding, testing, certification, mapping, connectivity** stay with the Ecosystem
  products (TGO Portal, Core Collaboration Access, onboarding and mapping) and can
  consume the same guide endpoint.
- **Trading Grid Insights, Command Center, Trading Grid Data Platform** are the
  operational and intelligence surfaces. Annotating a guide with production rejection
  evidence is directional, not built here.

## Running locally

```bash
npm install
export DATABASE_URL=postgres://localhost:5432/tg_open_guides
npm run migrate
npm run seed
npm start
```

Optional, for the Guide Builder's PDF import:

```bash
export ANTHROPIC_API_KEY=...   # or GEMINI_API_KEY=...
```

Without a model key the importer falls back to a deterministic structural extractor.
It is cruder, and it still produces a draft with page citations.

## Surfaces

| Path | For |
|---|---|
| `/` | catalog of published guides |
| `/g/:hub/:guide` | public guide page, latest attested version |
| `/g/:hub/:guide/v/:version` | a specific version |
| `/g/:hub/:guide.json` | the guide contract as JSON |
| `/g/:hub/:guide.md` | the guide as Markdown, for agent context |
| `/llms.txt` | catalog for agents |
| `/mcp` | MCP endpoint (streamable HTTP) |
| `/builder` | Guide Builder |
| `/hub/:hub/readership` | which versions and surfaces are being read |

## Licensing note

X12 licenses its standard. Publishing guide content derived from X12 publications
needs OpenText legal review before any external use. The seeded guides here are
fictional and hand-written for the prototype.
