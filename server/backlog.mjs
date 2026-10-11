/**
 * Product backlog for Trading Grid Open Guides as a standalone SaaS.
 *
 * Scope: a self-contained product on its own domain, hosted on Render, with its
 * own accounts. No Trading Grid integration, no white labelling, no billing.
 * Every registered account is fully entitled; personas differ by permission,
 * not by plan.
 *
 * Content is data rather than markup so it can be edited without touching a
 * renderer.
 */

export const PERSONAS = [
  { id: 'hub-owner', name: 'Hub owner', who: 'EDI or supply chain lead at a buying organisation.', needs: 'Create the hub, publish guides, attest versions, invite partners.' },
  { id: 'hub-editor', name: 'Hub editor', who: 'Analyst or consultant drafting on the hub’s behalf.', needs: 'Import and edit guides. Cannot attest or publish.' },
  { id: 'hub-admin', name: 'Hub administrator', who: 'Owner of the account, often the same person initially.', needs: 'Manage users, roles and hub profile.' },
  { id: 'partner-reader', name: 'Partner reader', who: 'Developer or analyst at a trading partner.', needs: 'Read requirements without an account.' },
  { id: 'partner-member', name: 'Partner member', who: 'Named contact at an invited partner.', needs: 'Track versions, receive change notices, convert to a hub.' },
  { id: 'agent', name: 'Agent', who: 'Software reading on a partner’s behalf.', needs: 'Machine-readable requirements, no credentials for public guides.' },
  { id: 'platform-admin', name: 'Platform administrator', who: 'Operator of the service.', needs: 'Account administration, abuse handling, support access.' }
];

export const EPICS = [
  {
    id: 'E1',
    name: 'Accounts and access',
    why: 'Nothing else can ship without identity. Currently the application has no users at all.',
    items: [
      { id: 'E1-1', title: 'Google sign-in', detail: 'Registration and login with a Google account. No password storage.', personas: ['hub-owner', 'hub-admin', 'partner-member'], size: 'M', state: 'Not started' },
      { id: 'E1-2', title: 'Email sign-in fallback', detail: 'Magic link for users without a Google account.', personas: ['hub-owner', 'partner-member'], size: 'M', state: 'Not started' },
      { id: 'E1-3', title: 'Sessions and sign-out', detail: 'Server sessions, device sign-out, session expiry.', personas: ['hub-owner'], size: 'S', state: 'Not started' },
      { id: 'E1-4', title: 'Account record', detail: 'An account owns one or more hubs. Separates the person from the organisation.', personas: ['hub-admin'], size: 'M', state: 'Not started' },
      { id: 'E1-5', title: 'Roles and permissions', detail: 'Owner, editor and reader per hub. Only owners attest and publish.', personas: ['hub-admin', 'hub-editor'], size: 'M', state: 'Not started' },
      { id: 'E1-6', title: 'Invite users to a hub', detail: 'Invite by email, assign a role, revoke access.', personas: ['hub-admin'], size: 'M', state: 'Not started' },
      { id: 'E1-7', title: 'Full entitlement', detail: 'Every account has every capability. No plans, no billing, no usage limits.', personas: ['platform-admin'], size: 'S', state: 'Decided' }
    ]
  },
  {
    id: 'E2',
    name: 'Standalone operation',
    why: 'The product must run on its own domain with no dependency on Trading Grid or an OpenText account.',
    items: [
      { id: 'E2-1', title: 'Remove platform assumptions', detail: 'No Trading Grid identifiers, entitlements or sign-on anywhere in the data model.', personas: ['platform-admin'], size: 'S', state: 'Done' },
      { id: 'E2-2', title: 'Own domain and TLS', detail: 'Move off the temporary Render subdomain to a product domain.', personas: ['platform-admin'], size: 'S', state: 'Not started' },
      { id: 'E2-3', title: 'Managed Postgres', detail: 'Provision the database and run migrations on deploy.', personas: ['platform-admin'], size: 'S', state: 'Blocked' },
      { id: 'E2-4', title: 'Model provider configuration', detail: 'One adapter, key set per environment. Required for guide import.', personas: ['platform-admin'], size: 'S', state: 'Blocked' },
      { id: 'E2-5', title: 'Backups and restore test', detail: 'Scheduled backups with a documented restore.', personas: ['platform-admin'], size: 'M', state: 'Not started' },
      { id: 'E2-6', title: 'Environments', detail: 'Separate staging and production services.', personas: ['platform-admin'], size: 'S', state: 'Not started' }
    ]
  },
  {
    id: 'E3',
    name: 'Hub onboarding',
    why: 'A hub owner must be able to go from sign-up to a published guide without support.',
    items: [
      { id: 'E3-1', title: 'Create a hub', detail: 'Name, legal name, industry, description, partner term.', personas: ['hub-owner'], size: 'M', state: 'Not started' },
      { id: 'E3-2', title: 'Hub profile editor', detail: 'Envelope identifiers, delimiters, X12 version, acknowledgment and interface windows.', personas: ['hub-owner'], size: 'M', state: 'Not started' },
      { id: 'E3-3', title: 'Hub-wide rules editor', detail: 'Rules that apply across every document, in the hub’s own words.', personas: ['hub-owner'], size: 'M', state: 'Not started' },
      { id: 'E3-4', title: 'Contacts', detail: 'Named contacts by what they resolve.', personas: ['hub-owner'], size: 'S', state: 'Not started' },
      { id: 'E3-5', title: 'Hub slug and availability', detail: 'Reserve a URL slug, check collisions, allow a rename with a redirect.', personas: ['hub-owner'], size: 'S', state: 'Not started' },
      { id: 'E3-6', title: 'Claim an existing hub', detail: 'Verify control of the organisation before transferring a hub created by someone else.', personas: ['hub-owner', 'platform-admin'], size: 'L', state: 'Not started' }
    ]
  },
  {
    id: 'E4',
    name: 'Guide authoring',
    why: 'Import exists but has never run against the database. Manual and agent-assisted paths do not exist.',
    items: [
      { id: 'E4-1', title: 'PDF import', detail: 'Upload, extract per page, compile to a draft with citations.', personas: ['hub-editor'], size: 'L', state: 'Built, untested' },
      { id: 'E4-2', title: 'Triaged review', detail: 'Gaps first, uncertain items next, confident items collapsed.', personas: ['hub-editor'], size: 'M', state: 'Built, untested' },
      { id: 'E4-3', title: 'Agent-authored guides', detail: 'An agent drafts a guide from a hub’s source documents and answers follow-up questions from the editor.', personas: ['hub-editor'], size: 'L', state: 'Not started' },
      { id: 'E4-4', title: 'Manual guide creation', detail: 'Author a guide with no source document, for hubs whose requirements are not written down.', personas: ['hub-editor'], size: 'L', state: 'Not started' },
      { id: 'E4-5', title: 'Import from Excel or Word', detail: 'Many hubs hold requirements in a spreadsheet rather than a PDF.', personas: ['hub-editor'], size: 'M', state: 'Not started' },
      { id: 'E4-6', title: 'Edit a published guide', detail: 'Open a published version as a new draft, diff against the previous one.', personas: ['hub-editor'], size: 'M', state: 'Not started' },
      { id: 'E4-7', title: 'Scenarios editor', detail: 'The hub declares its own processes. This is where process lives, not in a platform-defined sequence.', personas: ['hub-owner'], size: 'M', state: 'Not started' }
    ]
  },
  {
    id: 'E5',
    name: 'Attestation and publishing',
    why: 'Attestation is the product’s central claim and currently has no identity behind it.',
    items: [
      { id: 'E5-1', title: 'Attestation by a signed-in owner', detail: 'Replace the open link with an authenticated action recording the account.', personas: ['hub-owner'], size: 'M', state: 'Partial' },
      { id: 'E5-2', title: 'Attestation request', detail: 'An editor sends a version to an owner for signature, with a reminder.', personas: ['hub-editor', 'hub-owner'], size: 'M', state: 'Not started' },
      { id: 'E5-3', title: 'Visibility control', detail: 'Public, unlisted or partners only, changeable after publication.', personas: ['hub-owner'], size: 'S', state: 'Partial' },
      { id: 'E5-4', title: 'Version diff', detail: 'Show what changed between two published versions.', personas: ['hub-owner', 'partner-member'], size: 'M', state: 'Not started' },
      { id: 'E5-5', title: 'Withdraw a version', detail: 'Mark a published version as withdrawn without deleting it.', personas: ['hub-owner'], size: 'S', state: 'Not started' },
      { id: 'E5-6', title: 'Attestation record export', detail: 'A downloadable record of who signed what and when.', personas: ['hub-owner'], size: 'S', state: 'Not started' }
    ]
  },
  {
    id: 'E6',
    name: 'Partner network',
    why: 'The growth path is a partner reading a guide, then publishing their own. Nothing supports that today.',
    items: [
      { id: 'E6-1', title: 'Invite partners', detail: 'A hub invites its trading partners by email to its guides.', personas: ['hub-owner'], size: 'M', state: 'Not started' },
      { id: 'E6-2', title: 'Partner membership', detail: 'An invited partner gets an account linked to the hub, without seeing other partners.', personas: ['partner-member'], size: 'M', state: 'Not started' },
      { id: 'E6-3', title: 'Change notification', detail: 'Notify partner members when a guide they follow publishes a new version.', personas: ['partner-member'], size: 'M', state: 'Not started' },
      { id: 'E6-4', title: 'Partner becomes a hub', detail: 'A partner creates its own hub from the same account and publishes to its own suppliers.', personas: ['partner-member', 'hub-owner'], size: 'M', state: 'Not started' },
      { id: 'E6-5', title: 'Acknowledge receipt', detail: 'A partner records that it has read a version, giving the hub evidence of distribution.', personas: ['partner-member', 'hub-owner'], size: 'M', state: 'Not started' },
      { id: 'E6-6', title: 'Partner directory', detail: 'A hub sees which partners have accounts and which versions they are on.', personas: ['hub-owner'], size: 'M', state: 'Not started' }
    ]
  },
  {
    id: 'E7',
    name: 'Agent access',
    why: 'Built and working for public guides. Private guides have no agent authentication.',
    items: [
      { id: 'E7-1', title: 'Public JSON, Markdown and MCP', detail: 'Served from the published version.', personas: ['agent'], size: 'M', state: 'Done' },
      { id: 'E7-2', title: 'API keys for private guides', detail: 'A partner member issues a key to read guides that are not public.', personas: ['partner-member', 'agent'], size: 'M', state: 'Not started' },
      { id: 'E7-3', title: 'MCP authentication', detail: 'Carry the key through the MCP transport and scope results to it.', personas: ['agent'], size: 'M', state: 'Not started' },
      { id: 'E7-4', title: 'Rate limiting', detail: 'Per-key and per-address limits on all read surfaces.', personas: ['platform-admin'], size: 'S', state: 'Not started' }
    ]
  },
  {
    id: 'E8',
    name: 'Administration and operations',
    why: 'Running a multi-tenant service needs tenant isolation, support access and an audit trail.',
    items: [
      { id: 'E8-1', title: 'Tenant isolation', detail: 'Every query scoped by hub. Tested, not assumed.', personas: ['platform-admin'], size: 'L', state: 'Not started' },
      { id: 'E8-2', title: 'Platform admin console', detail: 'List accounts and hubs, suspend an account, handle abuse reports.', personas: ['platform-admin'], size: 'M', state: 'Not started' },
      { id: 'E8-3', title: 'Audit log', detail: 'Who changed, attested, published or withdrew what, and when.', personas: ['hub-admin', 'platform-admin'], size: 'M', state: 'Not started' },
      { id: 'E8-4', title: 'Transactional email', detail: 'Invitations, attestation requests, change notices.', personas: ['platform-admin'], size: 'M', state: 'Not started' },
      { id: 'E8-5', title: 'Error reporting and uptime', detail: 'Server error capture and an external health check.', personas: ['platform-admin'], size: 'S', state: 'Not started' },
      { id: 'E8-6', title: 'Account deletion and export', detail: 'Delete an account and export its hubs and guides.', personas: ['hub-admin'], size: 'M', state: 'Not started' }
    ]
  },
  {
    id: 'E9',
    name: 'Legal and compliance',
    why: 'Public distribution of hub requirements under an OpenText domain needs review before any real hub publishes.',
    items: [
      { id: 'E9-1', title: 'X12 licensing review', detail: 'X12 licenses its standard. Confirm what guide content may be published publicly.', personas: ['platform-admin'], size: 'M', state: 'Not started' },
      { id: 'E9-2', title: 'Terms of service', detail: 'Including who owns published guide content and what attestation means.', personas: ['platform-admin'], size: 'M', state: 'Not started' },
      { id: 'E9-3', title: 'Privacy notice', detail: 'Accounts hold names and work email addresses.', personas: ['platform-admin'], size: 'S', state: 'Not started' },
      { id: 'E9-4', title: 'Content ownership on authored guides', detail: 'When a consultant authors for a hub, the hub owns and attests the result.', personas: ['hub-owner', 'platform-admin'], size: 'S', state: 'Not started' },
      { id: 'E9-5', title: 'Accessibility review', detail: 'Keyboard navigation, contrast and screen reader pass on the reading surfaces.', personas: ['partner-reader'], size: 'M', state: 'Not started' }
    ]
  }
];

export const OUT_OF_SCOPE = [
  'Trading Grid integration or single sign-on.',
  'White labelling and customer-branded domains.',
  'Billing, plans, metering and usage limits.',
  'File validation, partner certification and mapping.',
  'Connectivity provisioning: AS2, SFTP, certificates.',
  'A platform-defined business process model. Process is declared by each hub as scenarios.',
  'An OpenText-maintained X12 standards library. Guide content comes from the hub’s own document.'
];
