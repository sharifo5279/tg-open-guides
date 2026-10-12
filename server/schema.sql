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

-- ---------------------------------------------------------------- accounts
-- One row per person. Credentials live with the identity provider, so there is
-- no password column here and there is not meant to be one.

CREATE TABLE IF NOT EXISTS accounts (
  id                TEXT PRIMARY KEY,
  email             TEXT UNIQUE NOT NULL,
  name              TEXT,
  is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at      TIMESTAMPTZ
);

-- An account can hold more than one sign-in method. Google today, email link
-- later, without migrating the account.
CREATE TABLE IF NOT EXISTS identities (
  id               TEXT PRIMARY KEY,
  account_id       TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL,              -- google | email
  provider_user_id TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);

-- Sessions are held server side so that access can be revoked.
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_account_idx ON sessions (account_id);

-- What an account may do inside one hub. The professional services author is an
-- editor with engagement_ends_at set, so the engagement expires on its own
-- rather than needing a role of its own.
CREATE TABLE IF NOT EXISTS memberships (
  id                 TEXT PRIMARY KEY,
  account_id         TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  hub_id             TEXT NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  role               TEXT NOT NULL,            -- owner | admin | editor | reader
  state              TEXT NOT NULL DEFAULT 'active',  -- invited | active | revoked
  invited_by         TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  invited_at         TIMESTAMPTZ,
  accepted_at        TIMESTAMPTZ,
  engagement_ends_at TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, hub_id)
);

CREATE INDEX IF NOT EXISTS memberships_hub_idx ON memberships (hub_id, state);

-- A partner's access to one guide that is not open. A request and its decision
-- are the same row, so the history of who approved what stays intact.
CREATE TABLE IF NOT EXISTS guide_access (
  id           TEXT PRIMARY KEY,
  guide_id     TEXT NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  account_id   TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  state        TEXT NOT NULL DEFAULT 'requested',  -- requested | granted | declined | revoked
  reason       TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by   TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  decided_at   TIMESTAMPTZ,
  UNIQUE (guide_id, account_id)
);

CREATE INDEX IF NOT EXISTS guide_access_state_idx ON guide_access (guide_id, state);

ALTER TABLE hubs ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES accounts(id) ON DELETE SET NULL;

-- Visibility becomes the hub's own access decision: open, behind approval, or
-- unlisted. The old values are migrated in place.
UPDATE guides SET visibility = 'open'     WHERE visibility = 'public';
UPDATE guides SET visibility = 'approval' WHERE visibility = 'community';
ALTER TABLE guides ALTER COLUMN visibility SET DEFAULT 'open';

-- A hub's contacts and hub-wide rules, in the hub's own words. Stored as
-- ordered lists on the hub because they are edited and read as a whole.
ALTER TABLE hubs ADD COLUMN IF NOT EXISTS contacts     JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE hubs ADD COLUMN IF NOT EXISTS common_rules JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Background compilation: the import keeps its own inputs, progress log and
-- attempt count, so a compile survives the browser closing and resumes after
-- a server restart.
ALTER TABLE imports ADD COLUMN IF NOT EXISTS meta     JSONB;
ALTER TABLE imports ADD COLUMN IF NOT EXISTS log      JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE imports ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

-- Review: a version remembers the import it was published from, so the
-- review can list its versions and publish the next one.
ALTER TABLE guide_versions ADD COLUMN IF NOT EXISTS import_id TEXT REFERENCES imports(id) ON DELETE SET NULL;
