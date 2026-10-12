/**
 * Creating and editing a hub.
 */
import { esc, layout } from './html.mjs';

const INDUSTRIES = [
  'Retail and consumer packaged goods',
  'Grocery retail',
  'Apparel and footwear retail',
  'Automotive manufacturing',
  'Industrial distribution and MRO',
  'Healthcare provider supply chain',
  'Energy and field services',
  'Third party logistics and transportation',
  'Other'
];

function field(label, name, value = '', { type = 'text', required = false, hint = '', placeholder = '' } = {}) {
  return `<label class="ff">
    <span class="ff-l">${esc(label)}${required ? '' : ' <i>optional</i>'}</span>
    <input type="${esc(type)}" name="${esc(name)}" value="${esc(value)}" ${required ? 'required' : ''} placeholder="${esc(placeholder)}">
    ${hint ? `<span class="ff-h">${esc(hint)}</span>` : ''}
  </label>`;
}

function rowInput(label, name, value = '', { type = 'text', placeholder = '' } = {}) {
  return `<label class="ff">
    <span class="ff-l">${esc(label)}</span>
    <input type="${esc(type)}" name="${esc(name)}" value="${esc(value || '')}" placeholder="${esc(placeholder)}">
  </label>`;
}

/* Existing rows plus two empty ones. A row left blank is removed on save. */
function withBlanks(rows, blank) {
  return [...(rows || []), blank, blank];
}

function contactRows(contacts) {
  return withBlanks(contacts, {}).map((c) => `<div class="ffrow"><div class="ffgrid">
    ${rowInput('Resolves', 'contactRole', c.role, { placeholder: 'EDI operations' })}
    ${rowInput('Name', 'contactName', c.name, { placeholder: 'EDI Support' })}
    ${rowInput('Email', 'contactEmail', c.email, { type: 'email', placeholder: 'edi@example.com' })}
    ${rowInput('Note', 'contactNote', c.note, { placeholder: 'Hours, or which issues to send here' })}
  </div></div>`).join('');
}

function ruleRows(rules) {
  return withBlanks(rules, {}).map((r) => `<div class="ffrow">
    <label class="ff">
      <span class="ff-l">Rule${r.id ? ` <i>${esc(r.id)}</i>` : ''}</span>
      <textarea name="ruleStatement" rows="2" placeholder="ISA15 must be T until production cutover is confirmed in writing.">${esc(r.statement || '')}</textarea>
    </label>
    <div class="ffgrid">
      ${rowInput('Applies to', 'ruleAppliesTo', r.appliesTo, { placeholder: 'ISA15, or transmission' })}
      ${rowInput('Reason', 'ruleRationale', r.rationale, { placeholder: 'Why the hub enforces it' })}
    </div>
  </div>`).join('');
}

export function renderHubForm({ hub = null, error = '', values = {} } = {}) {
  const editing = Boolean(hub);
  const v = { ...(hub || {}), ...values };
  const action = editing ? `/h/${esc(hub.slug)}/settings` : '/hubs';

  const body = `
<div class="phead"><div class="shell-narrow">
  <h1>${editing ? 'Hub settings' : 'Create a hub'}</h1>
  <p class="lede">${editing
    ? 'What partners read on this hub page.'
    : 'A hub publishes its own EDI requirements. Name the person who will own it.'}</p>
</div></div>

<section class="section"><div class="shell-narrow">
  ${error ? `<p class="notice notice-bad">${esc(error)}</p>` : ''}
  <form class="hubform" method="post" action="${action}">
    ${field('Hub name', 'name', v.name || '', { required: true, placeholder: 'Northwind Grocery Group' })}
    ${field('Legal name', 'legalName', v.legalName || '', { placeholder: 'Northwind Grocery Group Inc.' })}
    <label class="ff">
      <span class="ff-l">Industry <i>optional</i></span>
      <select name="industry">
        <option value="">Not stated</option>
        ${INDUSTRIES.map((i) => `<option value="${esc(i)}" ${v.industry === i ? 'selected' : ''}>${esc(i)}</option>`).join('')}
      </select>
    </label>
    ${editing
      ? ''
      : field('URL name', 'slug', v.slug || '', {
          hint: 'Lower case letters, numbers and hyphens. Left blank, it follows the hub name.',
          placeholder: 'northwind-grocery'
        })}
    ${editing
      ? ''
      : field('Owner email', 'ownerEmail', v.ownerEmail || '', {
          type: 'email',
          hint: 'The account that will attest and publish. Left blank, you own it. They must have signed in at least once.',
          placeholder: 'owner@company.com'
        })}
    ${field('Partner term', 'partnerTerm', v.partnerTerm || '', {
      hint: 'What this hub calls the organisations it trades with: supplier, vendor, carrier.',
      placeholder: 'supplier'
    })}
    <label class="ff">
      <span class="ff-l">About <i>optional</i></span>
      <textarea name="about" rows="3" placeholder="What this organisation does and who it trades with.">${esc(v.about || '')}</textarea>
    </label>
    ${editing ? `
    <h2 class="ff-sec">Contacts</h2>
    <p class="ff-h ff-sec-h">Who partners contact, by the issue each one resolves. Clear a row to remove it.</p>
    ${contactRows(v.contacts)}
    <h2 class="ff-sec">Hub-wide rules</h2>
    <p class="ff-h ff-sec-h">Requirements that apply to every document. Numbered in the order listed. Clear a rule to remove it.</p>
    ${ruleRows(v.commonRules)}` : ''}
    <div class="copyrow">
      <button class="btn" type="submit">${editing ? 'Save settings' : 'Create hub'}</button>
      ${editing ? `<a class="btn btn-quiet" href="/h/${esc(hub.slug)}">Back to hub</a>` : '<a class="btn btn-quiet" href="/account">Cancel</a>'}
    </div>
  </form>
</div></section>`;

  return layout({ title: `${editing ? 'Hub settings' : 'Create a hub'} | Trading Grid Open Guides`, body });
}
