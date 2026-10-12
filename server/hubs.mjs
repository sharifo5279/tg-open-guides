/**
 * Creating and editing a hub.
 *
 * Creating one makes the signed-in account its owner in the same transaction,
 * so a hub can never exist without someone who can attest for it.
 */
import { randomBytes } from 'node:crypto';
import { one, query } from './db.mjs';
import { addMembership, membershipIn, atLeast } from './accounts.mjs';
import { requireAccount } from './auth.mjs';
import { renderHubForm } from './render/hubform.mjs';

const RESERVED = new Set([
  'account', 'signin', 'signout', 'auth', 'hubs', 'h', 'g', 'mcp', 'static',
  'builder', 'backlog', 'for-agents', 'healthz', 'new', 'admin', 'api'
]);

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function clean(value, max = 200) {
  return String(value || '').trim().slice(0, max) || null;
}

/* The slug is a URL, so a collision with a seeded hub or a route has to be
   caught before the insert rather than surfacing as a 500. */
async function slugAvailable(slug) {
  if (!slug || RESERVED.has(slug)) return false;
  const taken = await one(`SELECT 1 FROM hubs WHERE slug = $1`, [slug]);
  return !taken;
}

export function mountHubs(app, { listHubs }) {
  app.get('/hubs/new', requireAccount, (req, res) => {
    res.type('html').send(renderHubForm({}));
  });

  app.post('/hubs', requireAccount, async (req, res, next) => {
    try {
      const values = {
        name: clean(req.body.name),
        legalName: clean(req.body.legalName),
        industry: clean(req.body.industry, 80),
        partnerTerm: clean(req.body.partnerTerm, 40),
        about: clean(req.body.about, 600),
        slug: slugify(req.body.slug || req.body.name)
      };

      if (!values.name) {
        return res.status(400).type('html').send(renderHubForm({ values, error: 'Enter a hub name.' }));
      }
      if (!values.slug) {
        return res.status(400).type('html').send(
          renderHubForm({ values, error: 'The URL name must contain a letter or number.' })
        );
      }
      const seeded = (await listHubs()).some((h) => h.slug === values.slug && !h.fromDb);
      if (seeded || !(await slugAvailable(values.slug))) {
        return res.status(409).type('html').send(
          renderHubForm({ values, error: `The URL name ${values.slug} is taken. Choose another.` })
        );
      }

      const hub = await one(
        `INSERT INTO hubs (id, slug, name, legal_name, industry, about, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          `hub_${randomBytes(10).toString('hex')}`,
          values.slug,
          values.name,
          values.legalName,
          values.industry,
          values.about,
          req.account.id
        ]
      );
      await addMembership({ accountId: req.account.id, hubId: hub.id, role: 'owner' });
      res.redirect(`/h/${hub.slug}`);
    } catch (err) {
      next(err);
    }
  });

  app.get('/h/:hub/settings', requireAccount, withHubRole('admin'), (req, res) => {
    res.type('html').send(renderHubForm({ hub: toForm(req.hubRow) }));
  });

  app.post('/h/:hub/settings', requireAccount, withHubRole('admin'), async (req, res, next) => {
    try {
      const name = clean(req.body.name);
      if (!name) {
        return res.status(400).type('html').send(
          renderHubForm({ hub: toForm(req.hubRow), error: 'Enter a hub name.', values: req.body })
        );
      }
      await query(
        `UPDATE hubs SET name = $2, legal_name = $3, industry = $4, about = $5 WHERE id = $1`,
        [
          req.hubRow.id,
          name,
          clean(req.body.legalName),
          clean(req.body.industry, 80),
          clean(req.body.about, 600)
        ]
      );
      res.redirect(`/h/${req.hubRow.slug}`);
    } catch (err) {
      next(err);
    }
  });
}

function toForm(row) {
  return {
    slug: row.slug,
    name: row.name,
    legalName: row.legal_name,
    industry: row.industry,
    about: row.about,
    partnerTerm: row.partner_term || ''
  };
}

/* Loads the hub by slug, then checks the membership against that row's id. The
   permission never comes from the URL on its own. */
export function withHubRole(role) {
  return async (req, res, next) => {
    try {
      const row = await one(`SELECT * FROM hubs WHERE slug = $1`, [req.params.hub]);
      if (!row) return res.status(404).type('html').send('Not found');
      req.hubRow = row;
      if (req.account?.is_platform_admin) return next();
      const m = await membershipIn(req.account.id, row.id);
      if (!m || !atLeast(m.role, role)) {
        return res.status(403).type('html').send('Not permitted');
      }
      req.membership = m;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/* What the signed-in account may do in one hub, for deciding which controls a
   page shows. Null when they are not a member. */
export async function roleInHub(account, hubSlug) {
  if (!account) return null;
  if (account.is_platform_admin) return 'owner';
  const row = await one(`SELECT id FROM hubs WHERE slug = $1`, [hubSlug]);
  if (!row) return null;
  const m = await membershipIn(account.id, row.id);
  return m?.role || null;
}
