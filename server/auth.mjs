/**
 * Sign-in routes and request authentication.
 *
 * Google is the provider. A development sign-in exists for working without
 * Google credentials; it refuses to start in production and is off unless
 * DEV_SIGNIN is set, so it cannot become an accidental way in.
 */
import { randomBytes, createHash } from 'node:crypto';
import {
  COOKIE,
  accountForSession,
  createSession,
  destroySession,
  findOrCreateAccount,
  membershipIn,
  membershipsFor,
  atLeast
} from './accounts.mjs';
import { dbAvailable } from './store.mjs';
import { requestContext } from './context.mjs';
import { renderSignIn } from './render/account.mjs';

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_INFO = 'https://openidconnect.googleapis.com/v1/userinfo';
const PENDING = new Map();          // state -> { verifier, next, at }
const PENDING_TTL = 10 * 60_000;

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function devSignInEnabled() {
  return process.env.DEV_SIGNIN === '1' && process.env.NODE_ENV !== 'production';
}

/* Secure is decided by the request, not by NODE_ENV, so the flag is correct on
   any host that terminates TLS in front of this process. */
function cookieOptions(req) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || req.get('x-forwarded-proto') === 'https',
    path: '/',
    maxAge: 30 * 86400_000
  };
}

function sweepPending() {
  const cutoff = Date.now() - PENDING_TTL;
  for (const [k, v] of PENDING) if (v.at < cutoff) PENDING.delete(k);
}

/* Only same-origin paths are accepted as a return target, so the sign-in link
   cannot be used to bounce someone to another site. */
function safeNext(value) {
  const next = String(value || '');
  return /^\/[^/\\]/.test(next) ? next : '/account';
}

/* ------------------------------------------------------ request context */

export function attachAccount() {
  return async (req, res, next) => {
    req.account = null;
    try {
      if (req.cookies?.[COOKIE] && (await dbAvailable())) {
        req.account = await accountForSession(req.cookies[COOKIE]);
      }
    } catch (err) {
      console.error('[auth] session lookup failed:', err.message);
    }
    res.locals.account = req.account;
    requestContext.run({ account: req.account }, next);
  };
}

export function requireAccount(req, res, next) {
  if (req.account) return next();
  const next_ = encodeURIComponent(req.originalUrl);
  return res.redirect(`/signin?next=${next_}`);
}

/* Role check for one hub. The hub is named by the caller, never read from the
   URL by this function, so a route cannot widen its own scope. */
export function requireRole(role) {
  return async (req, res, next) => {
    if (!req.account) return requireAccount(req, res, next);
    const hubId = req.hub?.id;
    if (!hubId) return res.status(404).send('Not found');
    if (req.account.is_platform_admin) return next();
    const m = await membershipIn(req.account.id, hubId);
    if (!m || !atLeast(m.role, role)) return res.status(403).send('Not permitted');
    req.membership = m;
    next();
  };
}

/* --------------------------------------------------------------- routes */

export function mountAuth(app, { baseUrlOf }) {
  app.get('/signin', async (req, res) => {
    if (req.account) return res.redirect(safeNext(req.query.next));
    res.type('html').send(
      renderSignIn({
        next: safeNext(req.query.next),
        google: googleConfigured(),
        dev: devSignInEnabled(),
        error: typeof req.query.error === 'string' ? req.query.error : '',
        dbReady: await dbAvailable()
      })
    );
  });

  app.get('/auth/google', (req, res) => {
    if (!googleConfigured()) return res.redirect('/signin?error=google_not_configured');
    sweepPending();
    const state = randomBytes(16).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    PENDING.set(state, { verifier, next: safeNext(req.query.next), at: Date.now() });
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const url = new URL(GOOGLE_AUTH);
    url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
    url.searchParams.set('redirect_uri', `${baseUrlOf(req)}/auth/google/callback`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('prompt', 'select_account');
    res.redirect(url.toString());
  });

  app.get('/auth/google/callback', async (req, res) => {
    const pending = PENDING.get(String(req.query.state || ''));
    PENDING.delete(String(req.query.state || ''));
    if (!pending) return res.redirect('/signin?error=expired');
    if (!req.query.code) return res.redirect('/signin?error=declined');
    try {
      const token = await fetch(GOOGLE_TOKEN, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(req.query.code),
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: `${baseUrlOf(req)}/auth/google/callback`,
          grant_type: 'authorization_code',
          code_verifier: pending.verifier
        })
      });
      if (!token.ok) throw new Error(`token exchange returned ${token.status}`);
      const { access_token } = await token.json();
      const info = await fetch(GOOGLE_INFO, { headers: { authorization: `Bearer ${access_token}` } });
      if (!info.ok) throw new Error(`userinfo returned ${info.status}`);
      const profile = await info.json();
      if (!profile.email_verified) return res.redirect('/signin?error=unverified_email');
      await signIn(req, res, {
        provider: 'google',
        providerUserId: profile.sub,
        email: profile.email,
        name: profile.name
      });
      res.redirect(pending.next);
    } catch (err) {
      console.error('[auth] google sign-in failed:', err.message);
      res.redirect('/signin?error=google_failed');
    }
  });

  if (devSignInEnabled()) {
    console.warn('[auth] development sign-in is enabled');
    app.post('/auth/dev', async (req, res) => {
      const email = String(req.body?.email || '').trim().toLowerCase();
      if (!email.includes('@')) return res.redirect('/signin?error=bad_email');
      await signIn(req, res, {
        provider: 'dev',
        providerUserId: email,
        email,
        name: String(req.body?.name || '').trim() || email.split('@')[0]
      });
      res.redirect(safeNext(req.body?.next));
    });
  }

  app.post('/auth/signout', async (req, res) => {
    await destroySession(req.cookies?.[COOKIE]);
    res.clearCookie(COOKIE, { path: '/' });
    res.redirect('/');
  });
}

async function signIn(req, res, profile) {
  const account = await findOrCreateAccount(profile);
  const { token } = await createSession(account.id, req.get('user-agent') || '');
  res.cookie(COOKIE, token, cookieOptions(req));
  return account;
}

export { membershipsFor };
