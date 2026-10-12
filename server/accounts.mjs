/**
 * Accounts, sessions and hub membership.
 *
 * Sessions are rows, not tokens: the cookie carries an opaque id and every
 * request resolves it, so revoking a session takes effect at once. Permission
 * is always derived from a membership row for a named hub, never from the URL.
 */
import { randomBytes, createHash } from 'node:crypto';
import { one, many, query } from './db.mjs';

const SESSION_DAYS = 30;
export const COOKIE = 'og_session';

/* Roles in descending authority. A role carries every right below it. */
const ORDER = ['reader', 'editor', 'admin', 'owner'];

export function atLeast(role, required) {
  const a = ORDER.indexOf(role);
  const b = ORDER.indexOf(required);
  return a >= 0 && b >= 0 && a >= b;
}

function id(prefix) {
  return `${prefix}_${randomBytes(12).toString('hex')}`;
}

/* ------------------------------------------------------------- accounts */

export async function findOrCreateAccount({ provider, providerUserId, email, name }) {
  const normalised = String(email || '').trim().toLowerCase();
  if (!normalised) throw new Error('an email address is required');

  const identity = await one(
    `SELECT a.* FROM identities i JOIN accounts a ON a.id = i.account_id
      WHERE i.provider = $1 AND i.provider_user_id = $2`,
    [provider, providerUserId]
  );
  if (identity) {
    await query(`UPDATE accounts SET last_seen_at = now() WHERE id = $1`, [identity.id]);
    return identity;
  }

  /* Same address arriving from a second provider joins the existing account
     rather than creating a duplicate person. */
  let account = await one(`SELECT * FROM accounts WHERE email = $1`, [normalised]);
  if (!account) {
    account = await one(
      `INSERT INTO accounts (id, email, name, last_seen_at)
       VALUES ($1, $2, $3, now()) RETURNING *`,
      [id('acc'), normalised, name || null]
    );
  } else if (!account.name && name) {
    await query(`UPDATE accounts SET name = $2, last_seen_at = now() WHERE id = $1`, [account.id, name]);
    account.name = name;
  }

  await query(
    `INSERT INTO identities (id, account_id, provider, provider_user_id)
     VALUES ($1, $2, $3, $4) ON CONFLICT (provider, provider_user_id) DO NOTHING`,
    [id('idn'), account.id, provider, providerUserId]
  );
  return account;
}

/* ------------------------------------------------------------- sessions */

/* The cookie holds the raw id; the table holds its hash, so a leaked database
   dump does not hand over live sessions. */
function hash(token) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(accountId, userAgent = '') {
  const token = randomBytes(24).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await query(
    `INSERT INTO sessions (id, account_id, user_agent, expires_at) VALUES ($1, $2, $3, $4)`,
    [hash(token), accountId, userAgent.slice(0, 300), expires]
  );
  return { token, expires };
}

export async function accountForSession(token) {
  if (!token) return null;
  const row = await one(
    `SELECT a.* FROM sessions s JOIN accounts a ON a.id = s.account_id
      WHERE s.id = $1 AND s.expires_at > now()`,
    [hash(token)]
  );
  return row || null;
}

export async function destroySession(token) {
  if (!token) return;
  await query(`DELETE FROM sessions WHERE id = $1`, [hash(token)]);
}

export async function destroyExpiredSessions() {
  const res = await query(`DELETE FROM sessions WHERE expires_at <= now()`);
  return res.rowCount;
}

/* ---------------------------------------------------------- memberships */

export async function membershipsFor(accountId) {
  return many(
    `SELECT m.*, h.slug AS hub_slug, h.name AS hub_name
       FROM memberships m JOIN hubs h ON h.id = m.hub_id
      WHERE m.account_id = $1 AND m.state = 'active'
        AND (m.engagement_ends_at IS NULL OR m.engagement_ends_at > now())
      ORDER BY h.name`,
    [accountId]
  );
}

export async function membershipIn(accountId, hubId) {
  if (!accountId || !hubId) return null;
  return one(
    `SELECT * FROM memberships
      WHERE account_id = $1 AND hub_id = $2 AND state = 'active'
        AND (engagement_ends_at IS NULL OR engagement_ends_at > now())`,
    [accountId, hubId]
  );
}

export async function addMembership({ accountId, hubId, role, invitedBy = null, engagementEndsAt = null }) {
  if (!ORDER.includes(role)) throw new Error(`unknown role: ${role}`);
  return one(
    `INSERT INTO memberships (id, account_id, hub_id, role, state, invited_by, accepted_at, engagement_ends_at)
     VALUES ($1, $2, $3, $4, 'active', $5, now(), $6)
     ON CONFLICT (account_id, hub_id)
       DO UPDATE SET role = EXCLUDED.role, state = 'active', engagement_ends_at = EXCLUDED.engagement_ends_at
     RETURNING *`,
    [id('mem'), accountId, hubId, role, invitedBy, engagementEndsAt]
  );
}

/* ---------------------------------------------------- platform administrators

   The PLATFORM_ADMINS environment variable is the single source of truth, and
   it is reconciled on every sign-in: an address added to it is promoted, an
   address removed from it is demoted. There is no other way to hold the flag,
   so a person removed from the list cannot keep it. */

export function platformAdminList() {
  return String(process.env.PLATFORM_ADMINS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function reconcilePlatformAdmin(account) {
  const shouldBe = platformAdminList().includes(String(account.email).toLowerCase());
  if (shouldBe === account.is_platform_admin) return account;
  await query(`UPDATE accounts SET is_platform_admin = $2 WHERE id = $1`, [account.id, shouldBe]);
  return { ...account, is_platform_admin: shouldBe };
}
