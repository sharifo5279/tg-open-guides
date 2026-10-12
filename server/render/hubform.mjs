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

export function renderHubForm({ hub = null, error = '', values = {} } = {}) {
  const editing = Boolean(hub);
  const v = { ...(hub || {}), ...values };
  const action = editing ? `/h/${esc(hub.slug)}/settings` : '/hubs';

  const body = `
<div class="phead"><div class="shell-narrow">
  <h1>${editing ? 'Hub settings' : 'Create a hub'}</h1>
  <p class="lede">${editing
    ? 'What partners read at the top of this hub.'
    : 'A hub publishes its own EDI requirements. You become its owner.'}</p>
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
    ${field('Partner term', 'partnerTerm', v.partnerTerm || '', {
      hint: 'What this hub calls the organisations it trades with: supplier, vendor, carrier.',
      placeholder: 'supplier'
    })}
    <label class="ff">
      <span class="ff-l">About <i>optional</i></span>
      <textarea name="about" rows="3" placeholder="What this organisation does and who it trades with.">${esc(v.about || '')}</textarea>
    </label>
    <div class="copyrow">
      <button class="btn" type="submit">${editing ? 'Save settings' : 'Create hub'}</button>
      ${editing ? `<a class="btn btn-quiet" href="/h/${esc(hub.slug)}">Back to hub</a>` : '<a class="btn btn-quiet" href="/account">Cancel</a>'}
    </div>
  </form>
</div></section>`;

  return layout({ title: `${editing ? 'Hub settings' : 'Create a hub'} | Trading Grid Open Guides`, body });
}
