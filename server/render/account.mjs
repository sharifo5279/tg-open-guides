/**
 * Sign-in and account pages.
 */
import { esc, layout } from './html.mjs';

const ERRORS = {
  expired: 'The sign-in request expired. Start again.',
  declined: 'Sign-in was cancelled.',
  google_failed: 'Google sign-in did not complete. Try again.',
  google_not_configured: 'Google sign-in is not configured on this environment.',
  unverified_email: 'Google has not verified this address.',
  bad_email: 'Enter a valid email address.'
};

export function renderSignIn({ next = '/account', google = false, dev = false, error = '', dbReady = true } = {}) {
  const message = ERRORS[error] || '';
  const body = `
<div class="phead"><div class="shell-narrow">
  <h1>Sign in</h1>
  <p class="lede">Publishing a guide requires an account. Reading open guides does not.</p>
</div></div>

<section class="section"><div class="shell-narrow">
  ${message ? `<p class="notice notice-bad">${esc(message)}</p>` : ''}
  ${dbReady ? '' : '<p class="notice">Accounts are unavailable because the database is not connected.</p>'}

  ${google
    ? `<div class="copyrow"><a class="btn" href="/auth/google?next=${encodeURIComponent(next)}">Continue with Google</a></div>`
    : '<p class="notice">Google sign-in is not configured on this environment.</p>'}

  ${dev
    ? `<form class="signin-dev" method="post" action="/auth/dev">
         <h2>Development sign-in</h2>
         <p class="section-sub">Available only outside production.</p>
         <input type="hidden" name="next" value="${esc(next)}">
         <div class="formrow">
           <label>Email<input type="email" name="email" required placeholder="you@example.com"></label>
           <label>Name<input type="text" name="name" placeholder="Optional"></label>
         </div>
         <button class="btn btn-outline" type="submit">Sign in</button>
       </form>`
    : ''}
</div></section>`;
  return layout({ title: 'Sign in | Trading Grid Open Guides', body });
}

export function renderAccount({ account, memberships = [] }) {
  const body = `
<div class="phead"><div class="shell-narrow">
  <h1>Account</h1>
  <ul class="specline">
    <li><b>${esc(account.name || account.email)}</b></li>
    <li>${esc(account.email)}</li>
    ${account.is_platform_admin ? '<li>Platform administrator</li>' : ''}
  </ul>
</div></div>

<section class="section"><div class="shell-narrow">
  <h2>Hubs</h2>
  <p class="section-sub">Where this account can publish. Reading open guides needs no membership.</p>
  ${memberships.length
    ? `<ul class="hublist">${memberships.map((m) => `<li class="hubrow"><a href="/h/${esc(m.hub_slug)}">
         <b>${esc(m.hub_name)}</b>
         <span class="el-note">${esc(m.role)}${m.engagement_ends_at ? `, until ${esc(String(m.engagement_ends_at).slice(0, 10))}` : ''}</span>
       </a></li>`).join('')}</ul>`
    : '<p class="notice">This account belongs to no hub yet.</p>'}
  <div class="copyrow" style="margin-top:18px"><a class="btn" href="/hubs/new">Create a hub</a></div>
</div></section>

<section class="section"><div class="shell-narrow">
  <form method="post" action="/auth/signout">
    <button class="btn btn-quiet" type="submit">Sign out</button>
  </form>
</div></section>`;
  return layout({ title: 'Account | Trading Grid Open Guides', body });
}
