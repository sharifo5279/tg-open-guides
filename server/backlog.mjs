/**
 * Product backlog for Trading Grid Open Guides as a standalone SaaS.
 *
 * Scope: a self-contained product on its own domain, hosted on Render, with its
 * own accounts. No Trading Grid entitlements or sign-on, no billing. Every
 * registered account is fully entitled; personas differ by permission, not by
 * plan.
 *
 * Content is data rather than markup so it can be edited without touching a
 * renderer.
 */

export const PERSONAS = [
  { id: 'hub-owner', name: 'Hub owner', who: 'EDI or supply chain lead at a buying organisation.', needs: 'Create the hub, publish guides, attest versions, approve access, invite partners.' },
  { id: 'hub-editor', name: 'Hub editor', who: 'Analyst drafting on the hub’s behalf.', needs: 'Run the authoring agent and correct its output. Cannot attest or publish.' },
  { id: 'hub-admin', name: 'Hub administrator', who: 'Owner of the account, often the same person initially.', needs: 'Manage users, roles, hub profile and identity.' },
  { id: 'ps-author', name: 'Professional services author', who: 'OpenText consultant engaged by a hub to write its guides.', needs: 'Author across assigned hubs, then hand the version to the owner. Cannot attest or publish.' },
  { id: 'partner-reader', name: 'Partner reader', who: 'Developer or analyst at a trading partner.', needs: 'Read open guides without an account. Request access to the rest.' },
  { id: 'partner-member', name: 'Partner member', who: 'Named contact at an invited partner.', needs: 'Track versions, receive change notices, convert to a hub.' },
  { id: 'agent', name: 'Agent', who: 'Software reading on a partner’s behalf.', needs: 'Machine-readable requirements, no credentials for open guides.' },
  { id: 'platform-admin', name: 'Platform administrator', who: 'Operator of the service.', needs: 'Account administration, engagement assignment, abuse handling, support access.' }
];

export const EPICS = [
  {
    id: 'E1',
    name: 'Accounts and access',
    why: 'Nothing else can ship without identity. The application has no users at all today.',
    items: [
      { id: 'E1-1', title: 'Google sign-in', detail: 'Registration and login with a Google account. No password storage.', personas: ['hub-owner', 'hub-admin', 'partner-member'], size: 'M', state: 'Done' },
      { id: 'E1-2', title: 'Email sign-in fallback', detail: 'Magic link for users without a Google account.', personas: ['hub-owner', 'partner-member'], size: 'M', state: 'Not started' },
      { id: 'E1-3', title: 'Sessions and sign-out', detail: 'Server sessions, device sign-out, session expiry.', personas: ['hub-owner'], size: 'S', state: 'Done' },
      { id: 'E1-4', title: 'Account record', detail: 'An account owns one or more hubs. Separates the person from the organisation.', personas: ['hub-admin'], size: 'M', state: 'Done' },
      { id: 'E1-5', title: 'Roles and permissions', detail: 'Owner, admin, editor and reader per hub. Only owners attest and publish.', personas: ['hub-admin', 'hub-editor'], size: 'M', state: 'Partial' },
      { id: 'E1-6', title: 'Invite users to a hub', detail: 'Invite by email, assign a role, revoke access.', personas: ['hub-admin'], size: 'M', state: 'Not started' },
      { id: 'E1-7', title: 'Professional services author role', detail: 'Authors across the hubs assigned to an engagement. Cannot attest or publish.', personas: ['ps-author', 'platform-admin'], size: 'M', state: 'Not started' },
      { id: 'E1-9', title: 'Platform administrators', detail: 'An environment list names who may sign in and who administers. Unset means nobody.', personas: ['platform-admin'], size: 'S', state: 'Done' },
      { id: 'E1-10', title: 'Open sign-in', detail: 'Anyone may hold an account. Today the environment list is the only way in, so a hub owner must be on it.', personas: ['hub-owner', 'partner-member'], size: 'S', state: 'Not started' },
      { id: 'E1-11', title: 'Self-service hub sign-up', detail: 'A partner creates its own hub without an administrator. Gated until the product is public.', personas: ['partner-member', 'hub-owner'], size: 'M', state: 'Not started' },
      { id: 'E1-8', title: 'Full entitlement', detail: 'No plans, billing or commercial metering. Capability differs by role, not by plan.', personas: ['platform-admin'], size: 'S', state: 'Decided' }
    ]
  },
  {
    id: 'E2',
    name: 'Standalone operation',
    why: 'The product must run on its own domain with no dependency on Trading Grid or an OpenText account.',
    items: [
      { id: 'E2-1', title: 'Remove platform assumptions', detail: 'No Trading Grid identifiers, entitlements or sign-on anywhere in the data model.', personas: ['platform-admin'], size: 'S', state: 'Done' },
      { id: 'E2-2', title: 'Own domain and TLS', detail: 'Move off the temporary Render subdomain to a product domain.', personas: ['platform-admin'], size: 'S', state: 'Not started' },
      { id: 'E2-3', title: 'Managed Postgres', detail: 'Provision the database and run migrations on deploy.', personas: ['platform-admin'], size: 'S', state: 'Done' },
      { id: 'E2-4', title: 'Model provider configuration', detail: 'One adapter, keys held by the application. Required for the authoring agent.', personas: ['platform-admin'], size: 'S', state: 'Done' },
      { id: 'E2-5', title: 'Backups and restore test', detail: 'Scheduled backups with a documented restore.', personas: ['platform-admin'], size: 'M', state: 'Not started' },
      { id: 'E2-6', title: 'Environments', detail: 'Separate staging and production services.', personas: ['platform-admin'], size: 'S', state: 'Not started' },
      { id: 'E2-7', title: 'Deploy on push', detail: 'Pushes to main do not start a Render deploy. Deploys are triggered manually until fixed.', personas: ['platform-admin'], size: 'S', state: 'Not started' }
    ]
  },
  {
    id: 'E3',
    name: 'Hub onboarding',
    why: 'A hub owner must be able to go from sign-up to a published guide without support.',
    items: [
      { id: 'E3-1', title: 'Create a hub', detail: 'A platform administrator creates the hub and names its owner by email.', personas: ['platform-admin', 'hub-owner'], size: 'M', state: 'Done' },
      { id: 'E3-2', title: 'Hub profile editor', detail: 'Envelope identifiers, delimiters, X12 version, acknowledgment and interface windows.', personas: ['hub-owner'], size: 'M', state: 'Partial' },
      { id: 'E3-3', title: 'Hub-wide rules editor', detail: 'Rules that apply across every document, in the hub’s own words.', personas: ['hub-owner'], size: 'M', state: 'Done' },
      { id: 'E3-4', title: 'Contacts', detail: 'Named contacts by what they resolve.', personas: ['hub-owner'], size: 'S', state: 'Done' },
      { id: 'E3-5', title: 'Hub slug and availability', detail: 'Reserve a URL slug, check collisions, allow a rename with a redirect.', personas: ['hub-owner'], size: 'S', state: 'Partial' },
      { id: 'E3-6', title: 'Claim an existing hub', detail: 'Verify control of the organisation before transferring a hub created by someone else.', personas: ['hub-owner', 'platform-admin'], size: 'L', state: 'Not started' },
      { id: 'E3-7', title: 'Flexible hub-wide rules', detail: 'Add, remove and reorder any number of hub-wide rules in hub settings, without the fixed empty rows.', personas: ['hub-owner'], size: 'S', state: 'Not started' }
    ]
  },
  {
    id: 'E4',
    name: 'Hub identity',
    why: 'A partner should recognise whose requirements they are reading. Parameters only, not a theme engine.',
    items: [
      { id: 'E4-1', title: 'Logo upload', detail: 'One logo per hub, with format and size limits, shown on the hub and guide pages.', personas: ['hub-admin'], size: 'S', state: 'Not started' },
      { id: 'E4-2', title: 'Accent colour', detail: 'One colour, rejected if it fails contrast against the page.', personas: ['hub-admin'], size: 'S', state: 'Not started' },
      { id: 'E4-3', title: 'Display name and strapline', detail: 'What partners read at the top of the hub page.', personas: ['hub-owner'], size: 'S', state: 'Not started' },
      { id: 'E4-4', title: 'Identity at first sign-in', detail: 'Collect logo, colour and display name during hub creation. Skippable.', personas: ['hub-owner'], size: 'S', state: 'Not started' },
      { id: 'E4-5', title: 'Default identity', detail: 'Hub initials and the product accent when nothing is uploaded.', personas: ['hub-admin'], size: 'S', state: 'Not started' }
    ]
  },
  {
    id: 'E5',
    name: 'Guide authoring',
    why: 'Authoring is the agent’s work and has two entry paths: a source document, or an interview when the hub has nothing written down. People correct and attest. The application supplies the model keys.',
    items: [
      { id: 'E5-1', title: 'Built-in authoring agent', detail: 'One agent with two entry paths, producing the same guide contract either way.', personas: ['hub-editor', 'ps-author'], size: 'L', state: 'Not started' },
      { id: 'E5-2', title: 'Author from a source document', detail: 'The compiler reads the PDF in overlapping windows and cites every finding to a page; uncited findings open for review.', personas: ['hub-editor', 'ps-author'], size: 'L', state: 'Done' },
      { id: 'E5-3', title: 'Author by interview', detail: 'No source document. The agent asks the hub what it requires and drafts from the answers.', personas: ['hub-owner', 'hub-editor', 'ps-author'], size: 'L', state: 'Not started' },
      { id: 'E5-4', title: 'Interview workflows', detail: 'A question set per transaction set, asking only what the hub has to decide.', personas: ['hub-editor'], size: 'L', state: 'Not started' },
      { id: 'E5-5', title: 'Standard knowledge at authoring time', detail: 'The agent brings segment and element knowledge to the interview. No standards library is stored or maintained.', personas: ['platform-admin'], size: 'M', state: 'Decided' },
      { id: 'E5-6', title: 'Resume an interview', detail: 'An interview spans sessions. Answers are saved as given and remain editable.', personas: ['hub-editor'], size: 'M', state: 'Not started' },
      { id: 'E5-7', title: 'Answer provenance', detail: 'An interview-authored guide cites the person and date behind each statement, as a document path cites a page.', personas: ['hub-owner', 'partner-reader'], size: 'M', state: 'Not started' },
      { id: 'E5-8', title: 'Platform-supplied model keys', detail: 'Keys are held by the application and never exposed to a hub.', personas: ['platform-admin'], size: 'S', state: 'Done' },
      { id: 'E5-9', title: 'Agent limits', detail: 'One import compiles up to 150 pages, with a stated message above that. Per-hub run and token caps are not started.', personas: ['platform-admin', 'hub-admin'], size: 'M', state: 'Partial' },
      { id: 'E5-10', title: 'Agent audit trail', detail: 'Each import records who started it, the model, the prompt version and a timed log of every chunk. Per-chunk prompts and raw output are not kept.', personas: ['hub-admin', 'platform-admin'], size: 'M', state: 'Partial' },
      { id: 'E5-11', title: 'Agent questions on a source document', detail: 'Where the document is silent or contradictory, the agent asks instead of asserting. Today gaps and conflicts appear as compiler gaps and notes. Decision needed before building: what an answer becomes (a rule, a hub note, or a change to the finding it concerns).', personas: ['hub-editor'], size: 'M', state: 'Not started' },
      { id: 'E5-12', title: 'PDF extraction', detail: 'Per-page text extraction feeding the document path.', personas: ['hub-editor'], size: 'L', state: 'Done' },
      { id: 'E5-13', title: 'Triaged review', detail: 'Superseded by E5-19: every finding is a row with a state; open findings are the review queue.', personas: ['hub-editor'], size: 'M', state: 'Done' },
      { id: 'E5-14', title: 'Excel and Word sources', detail: 'Word (.docx) and Excel (.xlsx) import alongside PDF. Citations for those refer to 60-line blocks of the document, stated in the compile log.', personas: ['hub-editor'], size: 'M', state: 'Done' },
      { id: 'E5-15', title: 'Manual correction', detail: 'Edit any field of any finding from the review screen; code values as one line per code.', personas: ['hub-editor', 'ps-author'], size: 'M', state: 'Done' },
      { id: 'E5-16', title: 'Revise a published guide', detail: 'Revise in Guide Builder opens a published version as a new draft; publishing creates the next version and the Versions tab shows the diff.', personas: ['hub-editor'], size: 'M', state: 'Done' },
      { id: 'E5-17', title: 'Scenarios editor', detail: 'Rules and scenarios can be added, edited and dropped in the review. A hub-facing editor outside the builder is not started.', personas: ['hub-owner'], size: 'M', state: 'Partial' },
      { id: 'E5-18', title: 'Background compilation', detail: 'Upload returns at once. The compile runs on the server with a live log, survives closing the page and restarts after a server restart.', personas: ['ps-author', 'hub-editor'], size: 'M', state: 'Done' },
      { id: 'E5-19', title: 'Review before publishing', detail: 'Every finding has a stable ID (F-001) and a state: open, confirmed, edited or dropped. Inline edit, filters, find, confirm all open. Drops are reversible until publication. The draft is saved on each change and reachable from the builder; a published import can be edited and published as the next version.', personas: ['ps-author', 'hub-editor'], size: 'L', state: 'Done' },
      { id: 'E5-20', title: 'Edit from the published guide', detail: 'An authorized editor opens a published guide and edits it in place. Saving creates a new version for attestation. For now an administrator sees Edit in Guide Builder on the guide, which opens the import review.', personas: ['hub-owner', 'hub-editor'], size: 'M', state: 'Not started' }
    ]
  },
  {
    id: 'E6',
    name: 'Attestation and publishing',
    why: 'Attestation is the product’s central claim and currently has no identity behind it.',
    items: [
      { id: 'E6-1', title: 'Attestation by a signed-in owner', detail: 'Replace the open link with an authenticated action recording the account.', personas: ['hub-owner'], size: 'M', state: 'Partial' },
      { id: 'E6-2', title: 'Attestation request', detail: 'An editor or professional services author sends a version to the owner for signature.', personas: ['hub-editor', 'ps-author', 'hub-owner'], size: 'M', state: 'Not started' },
      { id: 'E6-3', title: 'Version diff', detail: 'The Versions tab lists findings added, removed and changed since the previous version, by stable finding ID.', personas: ['hub-owner', 'partner-member'], size: 'M', state: 'Done' },
      { id: 'E6-4', title: 'Withdraw a version', detail: 'An administrator withdraws a published version from the Versions tab; the previous version becomes current, the withdrawn one stays readable and can be reinstated.', personas: ['hub-owner'], size: 'S', state: 'Done' },
      { id: 'E6-5', title: 'Attestation record export', detail: 'Each attested version serves attestation.json: signatory, role, date, version, and a SHA-256 of the signed content. Linked from the Versions tab.', personas: ['hub-owner'], size: 'S', state: 'Done' }
    ]
  },
  {
    id: 'E7',
    name: 'Guide access control',
    why: 'Each hub decides per guide whether a partner needs approval. Open guides onboard partners fastest and are the recommended default.',
    items: [
      { id: 'E7-1', title: 'Per-guide visibility', detail: 'Open, approval required or unlisted, set per guide and changeable after publication.', personas: ['hub-owner'], size: 'S', state: 'Partial' },
      { id: 'E7-2', title: 'Open by default', detail: 'New guides are open. The onboarding effect is stated at the point of choice.', personas: ['hub-owner'], size: 'S', state: 'Decided' },
      { id: 'E7-3', title: 'Mixed visibility in one hub', detail: 'A hub keeps some guides open and others behind approval, without a second hub.', personas: ['hub-owner'], size: 'S', state: 'Decided' },
      { id: 'E7-4', title: 'Partner access request', detail: 'A partner requests a guide behind approval, stating who they are and why.', personas: ['partner-reader'], size: 'M', state: 'Not started' },
      { id: 'E7-5', title: 'Request notice to the approver', detail: 'The owner receives the request by email and can approve or decline from it.', personas: ['hub-owner'], size: 'M', state: 'Not started' },
      { id: 'E7-6', title: 'Approval queue', detail: 'Pending requests in one list, with bulk approval for a known partner.', personas: ['hub-owner'], size: 'M', state: 'Not started' },
      { id: 'E7-7', title: 'Access grants', detail: 'An approval grants that account read access to that guide. Recorded and revocable.', personas: ['hub-owner', 'partner-member'], size: 'M', state: 'Not started' },
      { id: 'E7-8', title: 'Approval delegation', detail: 'Name who approves requests when the owner is unavailable.', personas: ['hub-admin'], size: 'S', state: 'Not started' }
    ]
  },
  {
    id: 'E8',
    name: 'Partner network',
    why: 'The growth path is a partner reading a guide, then publishing their own. Nothing supports that today.',
    items: [
      { id: 'E8-1', title: 'Invite partners', detail: 'A hub invites its trading partners by email to its guides.', personas: ['hub-owner'], size: 'M', state: 'Not started' },
      { id: 'E8-2', title: 'Partner membership', detail: 'An invited partner gets an account linked to the hub, without seeing other partners.', personas: ['partner-member'], size: 'M', state: 'Not started' },
      { id: 'E8-3', title: 'Partner becomes a hub', detail: 'A partner creates its own hub from the same account and publishes to its own suppliers.', personas: ['partner-member', 'hub-owner'], size: 'M', state: 'Not started' },
      { id: 'E8-4', title: 'Acknowledge receipt', detail: 'A partner records that it has read a version, giving the hub evidence of distribution.', personas: ['partner-member', 'hub-owner'], size: 'M', state: 'Not started' },
      { id: 'E8-5', title: 'Partner directory', detail: 'A hub sees which partners have accounts and which versions they are on.', personas: ['hub-owner'], size: 'M', state: 'Not started' }
    ]
  },
  {
    id: 'E9',
    name: 'Agent access',
    why: 'Built and working for open guides. Guides behind approval have no agent authentication.',
    items: [
      { id: 'E9-1', title: 'Open JSON, Markdown and MCP', detail: 'Served from the published version.', personas: ['agent'], size: 'M', state: 'Done' },
      { id: 'E9-2', title: 'API keys for restricted guides', detail: 'A partner member issues a key to read guides held behind approval.', personas: ['partner-member', 'agent'], size: 'M', state: 'Not started' },
      { id: 'E9-3', title: 'MCP authentication', detail: 'Carry the key through the MCP transport and scope results to it.', personas: ['agent'], size: 'M', state: 'Not started' },
      { id: 'E9-4', title: 'Rate limiting', detail: 'Per-key and per-address limits on all read surfaces.', personas: ['platform-admin'], size: 'S', state: 'Partial' }
    ]
  },
  {
    id: 'E10',
    name: 'Notifications and email',
    why: 'Registration, invitations and approvals all depend on mail that arrives. None of it is wired today.',
    items: [
      { id: 'E10-1', title: 'Email delivery provider', detail: 'One provider, configured per environment, with delivery failures logged.', personas: ['platform-admin'], size: 'M', state: 'Not started' },
      { id: 'E10-2', title: 'Sender domain authentication', detail: 'SPF, DKIM and DMARC on the sending domain so invitations are not filtered.', personas: ['platform-admin'], size: 'M', state: 'Not started' },
      { id: 'E10-3', title: 'Registration confirmation', detail: 'Confirm the address and name the account it created.', personas: ['hub-owner', 'partner-member'], size: 'S', state: 'Not started' },
      { id: 'E10-4', title: 'Hub user invitation', detail: 'Invitation to join a hub with a role, on an expiring link.', personas: ['hub-admin'], size: 'S', state: 'Not started' },
      { id: 'E10-5', title: 'Partner invitation', detail: 'Invitation from a hub to a trading partner, naming the guides.', personas: ['hub-owner'], size: 'S', state: 'Not started' },
      { id: 'E10-6', title: 'Access request and decision', detail: 'Request to the approver, decision to the requester.', personas: ['hub-owner', 'partner-reader'], size: 'S', state: 'Not started' },
      { id: 'E10-7', title: 'Attestation request and reminder', detail: 'To the owner, with one reminder before the request expires.', personas: ['hub-owner'], size: 'S', state: 'Not started' },
      { id: 'E10-8', title: 'Version change notice', detail: 'To partner members following a guide that has published a new version.', personas: ['partner-member'], size: 'S', state: 'Not started' },
      { id: 'E10-9', title: 'Notification preferences', detail: 'Per-user control over change notices, with an unsubscribe link in every notice.', personas: ['partner-member'], size: 'S', state: 'Not started' },
      { id: 'E10-10', title: 'Email templates', detail: 'One layout, with hub identity applied when the message comes from a hub.', personas: ['platform-admin'], size: 'S', state: 'Not started' }
    ]
  },
  {
    id: 'E11',
    name: 'Administration and operations',
    why: 'Running a multi-tenant service needs tenant isolation, support access and an audit trail.',
    items: [
      { id: 'E11-1', title: 'Tenant isolation', detail: 'Every query scoped by hub. Tested, not assumed.', personas: ['platform-admin'], size: 'L', state: 'Not started' },
      { id: 'E11-2', title: 'Platform admin console', detail: 'List accounts and hubs, suspend an account, handle abuse reports.', personas: ['platform-admin'], size: 'M', state: 'Not started' },
      { id: 'E11-3', title: 'Engagement assignment', detail: 'Assign a professional services author to a hub for a period, recorded in the audit log.', personas: ['platform-admin', 'ps-author'], size: 'M', state: 'Not started' },
      { id: 'E11-4', title: 'Audit log', detail: 'Who changed, attested, published, approved or withdrew what, and when.', personas: ['hub-admin', 'platform-admin'], size: 'M', state: 'Not started' },
      { id: 'E11-5', title: 'Error reporting and uptime', detail: 'Server errors are logged with their stack. The Render service has no health check path set although /healthz exists; set it in the service settings. External uptime monitoring is not started.', personas: ['platform-admin'], size: 'S', state: 'Partial' },
      { id: 'E11-6', title: 'Account deletion and export', detail: 'Delete an account and export its hubs and guides.', personas: ['hub-admin'], size: 'M', state: 'Not started' }
    ]
  },
  {
    id: 'E12',
    name: 'Legal and compliance',
    why: 'Public distribution of hub requirements needs review before any real hub publishes.',
    items: [
      { id: 'E12-1', title: 'X12 licensing review', detail: 'X12 licenses its standard. Confirm what guide content may be published openly.', personas: ['platform-admin'], size: 'M', state: 'Not started' },
      { id: 'E12-2', title: 'Terms of service', detail: 'Including who owns published guide content and what attestation means.', personas: ['platform-admin'], size: 'M', state: 'Not started' },
      { id: 'E12-3', title: 'Privacy notice', detail: 'Accounts hold names and work email addresses.', personas: ['platform-admin'], size: 'S', state: 'Not started' },
      { id: 'E12-4', title: 'Ownership of authored guides', detail: 'When professional services authors for a hub, the hub owns and attests the result.', personas: ['hub-owner', 'ps-author', 'platform-admin'], size: 'S', state: 'Not started' },
      { id: 'E12-5', title: 'Agent output disclosure', detail: 'The guide header states that the version was compiled by a language model from the named source, reviewed by a person and attested by the hub, with page citations on every finding.', personas: ['partner-reader', 'platform-admin'], size: 'S', state: 'Done' },
      { id: 'E12-6', title: 'Accessibility review', detail: 'Automated WCAG 2.1 AA check (axe) is clean on home, hub, guide, builder, review, agents, backlog and sign-in. A manual keyboard and screen-reader pass is not done.', personas: ['partner-reader'], size: 'M', state: 'Partial' }
    ]
  },
  {
    id: 'E14',
    name: 'Claude connector',
    why: 'Testing and demonstrating agent access from Claude.',
    items: [
      { id: 'E14-1', title: 'MCP connector for Claude', detail: 'The endpoint answers a standard MCP client (six tools listed and called over streamable HTTP). For agents shows the Claude Code command and the Claude.ai custom-connector URL. Not yet exercised from a Claude client.', personas: ['agent', 'platform-admin'], size: 'S', state: 'Built, untested' }
    ]
  },
  {
    id: 'E13',
    name: 'Later horizon',
    why: 'Sequenced after the items above. Recorded so the direction is not lost.',
    items: [
      { id: 'E13-1', title: 'Enterprise single sign-on', detail: 'SAML and OIDC against a hub’s own identity provider, with directory-driven roles.', personas: ['hub-admin'], size: 'L', state: 'Later' },
      { id: 'E13-2', title: 'Hub-owned domain', detail: 'Serve a hub’s guides on its own domain with a managed certificate.', personas: ['hub-owner'], size: 'L', state: 'Later' },
      { id: 'E13-3', title: 'Aviator agent ecosystem', detail: 'The authoring agent joins the Trading Grid Aviator agent ecosystem. It ships standalone first.', personas: ['hub-editor', 'platform-admin'], size: 'L', state: 'Later' }
    ]
  }
];

export const OUT_OF_SCOPE = [
  'Trading Grid entitlements and sign-on.',
  'Full theme control. Hub identity is a logo, one accent colour and a display name.',
  'Billing, plans and commercial metering. Every account is fully entitled.',
  'File validation, partner certification and mapping.',
  'Connectivity provisioning: AS2, SFTP, certificates.',
  'A platform-defined business process model. Process is declared by each hub as scenarios.',
  'An OpenText-maintained X12 standards library. Guide content comes from the hub, by document or by interview.'
];
