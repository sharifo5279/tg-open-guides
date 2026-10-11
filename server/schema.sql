-- Trading Grid Open Guides schema
-- The guide contract itself lives in guide_versions.spec as JSONB. A version is
-- immutable once published: a change to an attested guide creates a new version.

CREATE TABLE IF NOT EXISTS hubs (
  id           TEXT PRIMARY KEY,
  slug         TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  legal_name   TEXT,
  industry     TEXT,
  contact_name TEXT,
  contact_email TEXT,
  about        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guides (
  id              TEXT PRIMARY KEY,
  hub_id          TEXT NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  slug            TEXT NOT NULL,
  title           TEXT NOT NULL,
  standard        TEXT NOT NULL,              -- X12 | EDIFACT
  transaction_set TEXT NOT NULL,              -- 856, 850, 810
  std_version     TEXT NOT NULL,              -- 004010
  direction       TEXT NOT NULL,              -- partner_sends | partner_receives
  summary         TEXT,
  visibility      TEXT NOT NULL DEFAULT 'public',  -- public | unlisted | community
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hub_id, slug)
);

CREATE TABLE IF NOT EXISTS guide_versions (
  id             TEXT PRIMARY KEY,
  guide_id       TEXT NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  version        INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'draft',   -- draft | published | superseded
  spec           JSONB NOT NULL,
  source_name    TEXT,                            -- the PDF this was compiled from
  source_pages   INTEGER,
  compiled_by    TEXT,                            -- model id, or 'structural-fallback'
  changelog      TEXT,
  attested_by    TEXT,
  attested_role  TEXT,
  attested_at    TIMESTAMPTZ,
  published_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (guide_id, version)
);

CREATE INDEX IF NOT EXISTS guide_versions_guide_idx ON guide_versions (guide_id, version DESC);
CREATE INDEX IF NOT EXISTS guides_visibility_idx ON guides (visibility);

-- Import jobs: a PDF in flight through the compiler.
CREATE TABLE IF NOT EXISTS imports (
  id          TEXT PRIMARY KEY,
  hub_id      TEXT REFERENCES hubs(id) ON DELETE SET NULL,
  source_name TEXT NOT NULL,
  pages       INTEGER,
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | extracting | compiling | ready | failed
  error       TEXT,
  compiled_by TEXT,
  spec        JSONB,
  page_text   JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
