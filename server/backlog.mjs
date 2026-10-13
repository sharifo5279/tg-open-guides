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
      { id: 'E1-7', title: 'Professional services author role', detail: 'Authors across the hubs assigned to an engagement. Cannot attest or publish. Blocked today because the builder admits only the platform administrator.', personas: ['ps-author', 'platform-admin'], size: 'M', state: 'Not started' },
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
      { id: 'E2-5', title: 'Backups and restore test', detail: 'Scheduled backups with a documented restore. The database is on the Render basic plan; confirm its backup schedule in the Render dashboard and record the restore steps.', personas: ['platform-admin'], size: 'M', state: 'Not started' },
      { id: 'E2-6', title: 'Environments', detail: 'Separate staging and production services, created from render.yaml rather than by hand.', personas: ['platform-admin'], size: 'S', state: 'Not started' },
      { id: 'E2-7', title: 'Deploy on push', detail: 'A push to main deploys. The GitHub webhook was reinstalled by reconnecting the repository.', personas: ['platform-admin'], size: 'S', state: 'Done' }
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
      { id: 'E3-8', title: 'Publishing must not create a hub', detail: 'Publishing inserts a hub when the slug is unknown, with no creator and no owner, which bypasses administrator-gated creation and leaves a hub nobody can administer.', personas: ['platform-admin', 'hub-owner'], size: 'S', state: 'Not started' },
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
      { id: 'E5-3', title: 'Author by interview', detail: 'No source document. The agent asks the hub what it requires and drafts from the answers. See E19.', personas: ['hub-owner', 'hub-editor', 'ps-author'], size: 'L', state: 'Not started' },
      { id: 'E5-4', title: 'Interview workflows', detail: 'A question set per transaction set, asking only what the hub has to decide.', personas: ['hub-editor'], size: 'L', state: 'Not started' },
      { id: 'E5-5', title: 'Standard knowledge at authoring time', detail: 'The agent brings segment and element knowledge to the interview. No standards library is stored or maintained.', personas: ['platform-admin'], size: 'M', state: 'Decided' },
      { id: 'E5-6', title: 'Resume an interview', detail: 'An interview spans sessions. Answers are saved as given and remain editable. See E19.', personas: ['hub-editor'], size: 'M', state: 'Not started' },
      { id: 'E5-7', title: 'Answer provenance', detail: 'An interview-authored guide cites the person and date behind each statement, as a document path cites a page. See E19.', personas: ['hub-owner', 'partner-reader'], size: 'M', state: 'Not started' },
      { id: 'E5-8', title: 'Platform-supplied model keys', detail: 'Keys are held by the application and never exposed to a hub.', personas: ['platform-admin'], size: 'S', state: 'Done' },
      { id: 'E5-9', title: 'Agent limits', detail: 'One import compiles up to 150 pages. A page cap is not a spend cap: per-hub run, token and cost ceilings are not started, so an engagement can run unbounded against the platform key.', personas: ['platform-admin', 'hub-admin'], size: 'M', state: 'Partial' },
      { id: 'E5-10', title: 'Agent audit trail', detail: 'Each import records who started it, the model, the prompt version and a timed log of every chunk. Per-chunk prompts, raw output and per-finding authorship are not kept.', personas: ['hub-admin', 'platform-admin'], size: 'M', state: 'Partial' },
      { id: 'E5-11', title: 'Agent questions on a source document', detail: 'Where the document is silent or contradictory, the agent asks instead of asserting. Today gaps and conflicts appear as compiler gaps and notes. Decision needed before building: what an answer becomes (a rule, a hub note, or a change to the finding it concerns).', personas: ['hub-editor'], size: 'M', state: 'Not started' },
      { id: 'E5-12', title: 'PDF extraction', detail: 'Per-page text extraction feeding the document path.', personas: ['hub-editor'], size: 'L', state: 'Done' },
      { id: 'E5-13', title: 'Triaged review', detail: 'Superseded by E5-19: every finding is a row with a state; open findings are the review queue.', personas: ['hub-editor'], size: 'M', state: 'Done' },
      { id: 'E5-14', title: 'Excel and Word sources', detail: 'Word (.docx) and Excel (.xlsx) import alongside PDF. Citations for those refer to 60-line blocks of the document, stated in the compile log.', personas: ['hub-editor'], size: 'M', state: 'Done' },
      { id: 'E5-15', title: 'Manual correction', detail: 'Edit any field of any finding from the review screen; code values as one line per code.', personas: ['hub-editor', 'ps-author'], size: 'M', state: 'Done' },
      { id: 'E5-16', title: 'Revise a published guide', detail: 'Revise in Guide Builder opens a published version as a new draft; publishing creates the next version and the Versions tab shows the diff.', personas: ['hub-editor'], size: 'M', state: 'Done' },
      { id: 'E5-17', title: 'Scenarios editor', detail: 'Rules and scenarios can be added, edited and dropped in the review. A hub-facing editor outside the builder is not started.', personas: ['hub-owner'], size: 'M', state: 'Partial' },
      { id: 'E5-18', title: 'Background compilation', detail: 'Upload returns at once. The compile runs on the server with a live log, survives closing the page and restarts after a server restart.', personas: ['ps-author', 'hub-editor'], size: 'M', state: 'Done' },
      { id: 'E5-19', title: 'Review before publishing', detail: 'Every finding has a stable ID (F-001) and a state: open, confirmed, edited or dropped. Inline edit, filters, find, confirm all open. Drops are reversible until publication. The draft is saved on each change and reachable from the builder; a published import can be edited and published as the next version.', personas: ['ps-author', 'hub-editor'], size: 'L', state: 'Done' },
      { id: 'E5-21', title: 'Open the builder to editors and authors', detail: 'Only the platform administrator can open the builder, so neither the hub editor nor the professional services author can do the work the product assigns them.', personas: ['hub-editor', 'ps-author'], size: 'M', state: 'Not started' },
      { id: 'E5-22', title: 'An import belongs to a hub', detail: 'The hub is recorded at upload rather than at publication, so permission can be checked while the work happens and a list can be scoped to one hub.', personas: ['ps-author', 'platform-admin'], size: 'M', state: 'Not started' },
      { id: 'E5-23', title: 'Concurrent review safety', detail: 'Review edits rewrite the whole draft, so two reviewers on one import silently overwrite each other. Edits need a version check and a stale-edit message.', personas: ['hub-editor', 'ps-author'], size: 'M', state: 'Not started' },
      { id: 'E5-24', title: 'Source text beside the finding', detail: 'Show the cited page next to the item so a reviewer can confirm it without opening the original. The page text is already stored on the import.', personas: ['hub-editor', 'ps-author'], size: 'M', state: 'Not started' },
      { id: 'E5-25', title: 'Send a finding to the hub', detail: 'Route the items the source does not answer to the hub owner and record the answer against the finding.', personas: ['hub-editor', 'hub-owner', 'ps-author'], size: 'M', state: 'Not started' },
      { id: 'E5-26', title: 'Per-finding authorship', detail: 'Each finding carries who last changed it and when, so a reviewer can see what a colleague decided.', personas: ['hub-editor', 'ps-author'], size: 'S', state: 'Not started' },
      { id: 'E5-27', title: 'Model failover', detail: 'A provider error fails the import. The second configured provider should take the chunk, with the substitution logged.', personas: ['platform-admin'], size: 'M', state: 'Not started' },
      { id: 'E5-28', title: 'Find an import', detail: 'The builder lists the twelve most recent imports with no search, filter or paging.', personas: ['ps-author', 'platform-admin'], size: 'S', state: 'Not started' },
      { id: 'E5-20', title: 'Edit from the published guide', detail: 'An authorized editor opens a published guide and edits it in place. Saving creates a new version for attestation. For now an administrator sees Edit in Guide Builder on the guide, which opens the import review.', personas: ['hub-owner', 'hub-editor'], size: 'M', state: 'Not started' }
    ]
  },
  {
    id: 'E6',
    name: 'Attestation and publishing',
    why: 'Attestation is the product’s central claim and currently has no identity behind it.',
    items: [
      { id: 'E6-1', title: 'Attestation by a signed-in owner', detail: 'The signatory signs with their own account, and the record binds that account to the content hash of what they signed. Today the platform administrator types the name and role as free text, so nobody at the hub has seen the document.', personas: ['hub-owner'], size: 'L', state: 'Partial' },
      { id: 'E6-2', title: 'Attestation request', detail: 'An author marks a draft ready and sends it to a named signatory, who sees what changed since the last version before signing. There is no ready state today: a draft is either open or published.', personas: ['hub-editor', 'ps-author', 'hub-owner'], size: 'M', state: 'Not started' },
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
    why: 'Supplier portal territory under the scope tests. Held at Later; revisit only with a stated reason.',
    items: [
      { id: 'E8-1', title: 'Invite partners', detail: 'A hub invites its trading partners by email to its guides.', personas: ['hub-owner'], size: 'M', state: 'Later' },
      { id: 'E8-2', title: 'Partner membership', detail: 'An invited partner gets an account linked to the hub, without seeing other partners.', personas: ['partner-member'], size: 'M', state: 'Later' },
      { id: 'E8-3', title: 'Partner becomes a hub', detail: 'A partner creates its own hub from the same account and publishes to its own suppliers.', personas: ['partner-member', 'hub-owner'], size: 'M', state: 'Later' },
      { id: 'E8-4', title: 'Acknowledge receipt', detail: 'A partner records that it has read a version, giving the hub evidence of distribution.', personas: ['partner-member', 'hub-owner'], size: 'M', state: 'Later' },
      { id: 'E8-5', title: 'Partner directory', detail: 'A hub sees which partners have accounts and which versions they are on.', personas: ['hub-owner'], size: 'M', state: 'Later' }
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
      { id: 'E10-5', title: 'Partner invitation', detail: 'Invitation from a hub to a trading partner, naming the guides.', personas: ['hub-owner'], size: 'S', state: 'Later' },
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
      { id: 'E11-1', title: 'Tenant isolation', detail: 'Every query scoped by hub, tested rather than assumed. The builder is the open case: it lists every import across every hub.', personas: ['platform-admin'], size: 'L', state: 'Not started' },
      { id: 'E11-2', title: 'Platform admin console', detail: 'List accounts and hubs, suspend an account, handle abuse reports.', personas: ['platform-admin'], size: 'M', state: 'Not started' },
      { id: 'E11-3', title: 'Engagement assignment', detail: 'Assign a professional services author to a hub for a period, recorded in the audit log.', personas: ['platform-admin', 'ps-author'], size: 'M', state: 'Not started' },
      { id: 'E11-4', title: 'Audit log', detail: 'Who changed, attested, published, approved or withdrew what, and when.', personas: ['hub-admin', 'platform-admin'], size: 'M', state: 'Not started' },
      { id: 'E11-5', title: 'Error reporting and uptime', detail: 'Server errors are logged with their stack. The health check path is still unset on the service although /healthz answers. External uptime monitoring is not started.', personas: ['platform-admin'], size: 'S', state: 'Partial' },
      { id: 'E11-7', title: 'Import retention', detail: 'Every import keeps its full page text indefinitely and nothing can be deleted, which fills a 1GB database with abandoned drafts.', personas: ['platform-admin'], size: 'S', state: 'Not started' },
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
    id: 'E15',
    name: 'Multi-document imports',
    why: 'Hub requirements are spread across a guide, rules decks and spreadsheets. One draft has to be built from all of them, with every finding traceable to the file it came from.',
    items: [
      { id: 'E15-1', title: 'Several files in one import', detail: 'One import accepts up to 10 files for one hub, one transaction set and one direction, and compiles them into a single draft. Typical set: the implementation guide PDF, a business rules deck and a spreadsheet of hub notes.', personas: ['ps-author', 'hub-editor'], size: 'L', state: 'Not started' },
      { id: 'E15-2', title: 'Source register', detail: 'Each file in an import is a source with an ID (S1, S2), file name, type, page or block count and its citation unit. The register is shown on the review and stored on the import and on every version published from it.', personas: ['ps-author', 'hub-editor'], size: 'M', state: 'Not started' },
      { id: 'E15-3', title: 'Source-qualified citations', detail: 'A citation names its source and location: "rules-deck.pptx p.4", "routing.xlsx block 2", "guide.pdf p.12". Single-file imports and versions already published keep their page-only citations and render unchanged.', personas: ['ps-author', 'hub-editor'], size: 'M', state: 'Not started' },
      { id: 'E15-4', title: 'Per-source compile and merge', detail: 'The compiler runs per source in the background, with each source logged separately, and merges into one draft with the same segment, element and rule keys used to merge chunks today. A failed source is a gap; the others still compile.', personas: ['ps-author', 'hub-editor'], size: 'L', state: 'Not started' },
      { id: 'E15-5', title: 'Conflicts between sources', detail: 'When two sources state different values for the same finding (usage, length, max use, accepted values, a rule), the draft keeps both as one Open finding marked as a conflict, citing each source. The reviewer chooses; nothing is merged silently.', personas: ['ps-author', 'hub-editor'], size: 'M', state: 'Not started' },
      { id: 'E15-6', title: 'Add a source to a draft', detail: 'Upload another file into an import under review. It compiles and merges into the existing draft; findings already confirmed, edited or dropped keep their state, and new findings arrive Open.', personas: ['ps-author', 'hub-editor'], size: 'M', state: 'Not started' },
      { id: 'E15-7', title: 'Remove a source', detail: 'Remove a source from a draft. Findings cited only to that source are dropped, reversibly until publication; findings also cited elsewhere keep their remaining citations.', personas: ['ps-author', 'hub-editor'], size: 'S', state: 'Not started' },
      { id: 'E15-8', title: 'PowerPoint sources', detail: 'Import .pptx. One slide is one citable page; slide text, tables and speaker notes are extracted in reading order.', personas: ['ps-author', 'hub-editor'], size: 'S', state: 'Not started' }
    ]
  },
  {
    id: 'E16',
    name: 'Multi-set documents',
    why: 'Many hubs publish one document for 850, 855, 856 and 810. Today it is imported once per set. One import should produce a guide per set.',
    items: [
      { id: 'E16-1', title: 'Transaction set detection', detail: 'On extraction, detect which transaction sets a document covers and the page ranges for each, from headings, ST01 values and segment tables. Show the result before compiling, for the author to confirm or correct.', personas: ['ps-author', 'hub-editor'], size: 'M', state: 'Not started' },
      { id: 'E16-2', title: 'Choose sets to build', detail: 'The author selects which detected sets to build. Each selected set becomes its own draft with its own review, sharing the source file; unselected sets are not compiled.', personas: ['ps-author', 'hub-editor'], size: 'M', state: 'Not started' },
      { id: 'E16-3', title: 'Page routing per set', detail: 'Each set\'s compile reads only its own page range plus pages marked shared (front matter, envelope, delimiters, contacts, general rules), so a 120-page four-set guide does not cost four full reads.', personas: ['ps-author', 'hub-editor'], size: 'M', state: 'Not started' },
      { id: 'E16-4', title: 'Shared content across sets', detail: 'Envelope, delimiters and contacts found on shared pages go into every guide built from the document. Decision needed: whether general business rules on shared pages are copied into each guide or published once as hub-wide rules (E3-7).', personas: ['ps-author', 'hub-editor'], size: 'M', state: 'Not started' },
      { id: 'E16-5', title: 'Grouped review and publish', detail: 'The builder groups drafts that came from one document and shows review progress for each. Each set is reviewed, published and attested as its own guide; one set can publish while others are still in review.', personas: ['ps-author', 'hub-editor'], size: 'M', state: 'Not started' },
      { id: 'E16-6', title: 'Re-import a revised document', detail: 'A new edition matches each set to its existing guide and produces the next version with a diff. The decision ledger, E18, is what carries the previous review forward.', personas: ['ps-author', 'hub-editor'], size: 'L', state: 'Not started' }
    ]
  },
  {
    id: 'E17',
    name: 'Product home and sign-up',
    why: 'The home page reads as a prototype catalogue and does not convert. It has to present Open Guides as a standalone SaaS product and take every known persona from landing to its first task.',
    items: [
      { id: 'E17-1', title: 'Product home page', detail: 'Rebuild the home page as the front door of a standalone SaaS product: what it is, how it works in three steps, sample guides as proof, and one primary call to action. The hub list moves to its own directory page.', personas: ['hub-owner', 'hub-admin', 'hub-editor', 'ps-author', 'partner-reader', 'partner-member', 'agent', 'platform-admin'], size: 'L', state: 'Not started' },
      { id: 'E17-2', title: 'A path for every persona', detail: 'The home page routes each known persona to its first task: hub owner and admin to sign up and create a hub; hub editor and professional services author to the Guide Builder; partner reader to find a hub and read a guide; partner member to request access; agent developers to the MCP and API setup; platform administrator to sign in.', personas: ['hub-owner', 'hub-admin', 'hub-editor', 'ps-author', 'partner-reader', 'partner-member', 'agent', 'platform-admin'], size: 'M', state: 'Not started' },
      { id: 'E17-3', title: 'Positioning and copy', detail: 'Rewrite home, sign-in and empty-state copy to the product writing standard: outcome-led headings, one-sentence descriptions, specific action buttons, no internal or prototype language.', personas: ['hub-owner', 'hub-admin', 'hub-editor', 'ps-author', 'partner-reader', 'partner-member', 'agent', 'platform-admin'], size: 'M', state: 'Not started' },
      { id: 'E17-4', title: 'Sign-up flow', detail: 'A visitor signs up with Google, names the hub, and lands in the Guide Builder with a first import prompt. Partners sign in to read or request access without creating a hub. Depends on E1-10 Open sign-in and E1-11 Self-service hub sign-up, both held while access is limited to the platform administrator.', personas: ['hub-owner', 'hub-admin', 'partner-reader', 'partner-member'], size: 'L', state: 'Not started' },
      { id: 'E17-5', title: 'Standalone presentation', detail: 'Remove internal links and prototype notices from public pages (the backlog link, the fictional-content footer), and add the pages a standalone product needs: availability statement, terms (E12-2), privacy (E12-3) and contact.', personas: ['hub-owner', 'hub-admin', 'hub-editor', 'ps-author', 'partner-reader', 'partner-member', 'agent', 'platform-admin'], size: 'M', state: 'Not started' },
      { id: 'E17-6', title: 'Conversion measurement', detail: 'Count visits, sign-up starts, completed sign-ups and first imports by persona path, so the home page can be judged on conversion. Aggregate counts only; no third-party tracking.', personas: ['platform-admin'], size: 'S', state: 'Not started' }
    ]
  },
  {
    id: 'E18',
    name: 'Decision ledger',
    why: 'A review decision is the expensive part of a guide, and today it is thrown away with the draft. Keeping decisions and matching them to the next edition of a document is what makes a version upgrade minutes rather than a repeat engagement.',
    items: [
      { id: 'E18-1', title: 'Decisions outlive the draft', detail: 'A decision is stored against the guide rather than inside the import it was made in, so the next edition can reach it.', personas: ['hub-editor', 'ps-author'], size: 'L', state: 'Not started' },
      { id: 'E18-2', title: 'What a decision records', detail: 'The subject, what the compiler proposed, what the reviewer chose, any wording they substituted, who decided and when.', personas: ['hub-editor', 'ps-author', 'hub-admin'], size: 'M', state: 'Not started' },
      { id: 'E18-3', title: 'Stable decision anchors', detail: 'A decision identifies its subject structurally, by segment and element or by rule subject, never by finding ID or page number, both of which move between editions.', personas: ['ps-author'], size: 'L', state: 'Not started' },
      { id: 'E18-4', title: 'Source fingerprint per decision', detail: 'Each decision stores a hash of the source text it was made against, which is what distinguishes a decision that still holds from one whose ground has moved.', personas: ['ps-author'], size: 'M', state: 'Not started' },
      { id: 'E18-5', title: 'Classify a new edition', detail: 'On re-import every finding is sorted into unchanged, source changed, new, or withdrawn, and the reviewer sees the four counts before any work.', personas: ['hub-editor', 'ps-author'], size: 'L', state: 'Not started' },
      { id: 'E18-6', title: 'Carry unchanged decisions in bulk', detail: 'One action applies every decision whose source text is identical, with the list reviewable and reversible before it is applied.', personas: ['hub-editor', 'ps-author'], size: 'M', state: 'Not started' },
      { id: 'E18-7', title: 'Review what changed', detail: 'For each changed item, the old source, the new source and the prior decision side by side, with keep, amend or re-decide.', personas: ['hub-editor', 'ps-author', 'hub-owner'], size: 'L', state: 'Not started' },
      { id: 'E18-8', title: 'Bulk actions on the changed pile', detail: 'Group changed items by the shape of the change, such as wording only or value only, so a reviewer can accept a group rather than a row at a time.', personas: ['hub-editor', 'ps-author'], size: 'M', state: 'Not started' },
      { id: 'E18-9', title: 'Withdrawn requirements', detail: 'A prior decision whose subject is absent from the new edition is surfaced rather than dropped, because a removed requirement is a change the hub should confirm deliberately.', personas: ['hub-owner', 'hub-editor'], size: 'M', state: 'Not started' },
      { id: 'E18-10', title: 'Never auto-apply to changed source', detail: 'A decision applies automatically only where the source text is byte-identical. Anything else is a human call, so the ledger cannot silently carry a stale requirement into a new version.', personas: ['platform-admin', 'hub-owner'], size: 'S', state: 'Decided' },
      { id: 'E18-11', title: 'Decision provenance on the version', detail: 'The published version records how many items were carried, re-decided, added and withdrawn, and the signatory sees those counts before signing.', personas: ['hub-owner', 'partner-reader'], size: 'M', state: 'Not started' },
      { id: 'E18-12', title: 'Decision history per item', detail: 'A guide item shows the decisions made about it across versions, so a reviewer can see that wording was already disputed and settled.', personas: ['hub-editor', 'hub-owner'], size: 'M', state: 'Not started' },
      { id: 'E18-13', title: 'Decisions across a hub\u2019s guides', detail: 'Envelope, code list and contact decisions recur across a hub\u2019s transaction sets. Offering them across guides saves repeated work, and is riskier than within one guide, so it comes after the single-guide case works.', personas: ['ps-author', 'hub-editor'], size: 'L', state: 'Not started' },
      { id: 'E18-14', title: 'Standing preference, not a decision', detail: 'A choice the hub applies to every document is hub-wide rules (E3-3), not a ledger entry. The ledger holds decisions about one guide\u2019s content.', personas: ['hub-owner'], size: 'S', state: 'Decided' }
    ]
  },
  {
    id: 'E19',
    name: 'Build from scratch with Trading Grid Aviator',
    why: 'Some hubs have no written guide. Trading Grid Aviator builds one by asking the right questions in order, and the result lands in Open Guides ready for review and attestation. Design: https://claude.ai/artifact/8fA31FXAjyJrcx5ixUvrqi (boards C1 to C8; option C, Interview.dc.html, is the chosen start).',
    items: [
      { id: 'E19-1', title: 'Choose how to start', detail: 'Aviator opens with three starts: attach documents, build from scratch, revise a published guide. Choosing scratch states that progress saves after every answer and a document can be attached at any point, which switches the remaining steps to the document path and merges.', design: 'C1-Start.dc.html', personas: ['hub-owner', 'hub-editor', 'ps-author'], size: 'M', state: 'Not started' },
      { id: 'E19-2', title: 'Guide basics', detail: 'Aviator asks hub, transaction set, standard and version, who sends the document, and the title partners see. Each question offers one-click answers and accepts free text.', design: 'C2-Basics.dc.html', personas: ['hub-owner', 'hub-editor', 'ps-author'], size: 'M', state: 'Not started' },
      { id: 'E19-3', title: 'Envelope and delimiters', detail: 'One structured card for the hub\'s own identifiers (ISA qualifier and ID, GS02, production and test), separators and ISA15 usage. States that partner identifiers are not part of the guide.', design: 'C3-Envelope.dc.html', personas: ['hub-owner', 'hub-editor', 'ps-author'], size: 'S', state: 'Not started' },
      { id: 'E19-4', title: 'Structure by area', detail: 'Aviator lists the standard segments for the chosen set and version, area by area, from model knowledge at authoring time. The hub marks each Mandatory, Used or Not used and can add a segment. The standard column is reference only and is never stored or published (E5-5).', design: 'C4-Structure.dc.html', personas: ['hub-owner', 'hub-editor', 'ps-author'], size: 'L', state: 'Not started' },
      { id: 'E19-5', title: 'Elements and codes', detail: 'For each segment the hub keeps, Aviator walks its elements: accepted codes (common codes offered, any code searchable), lengths and a note for partners. A side table shows the segment as saved.', design: 'C5-Elements.dc.html', personas: ['hub-owner', 'hub-editor', 'ps-author'], size: 'L', state: 'Not started' },
      { id: 'E19-6', title: 'Business rules and contacts', detail: 'The hub states rules in its own words; Aviator records the wording verbatim, asks one scoping follow-up (which order types, which segment) and assigns the next rule ID. Then asks for EDI contacts.', design: 'C6-Rules.dc.html', personas: ['hub-owner', 'hub-editor', 'ps-author'], size: 'M', state: 'Not started' },
      { id: 'E19-7', title: 'Interview citations', detail: 'A finding authored by interview cites "Interview, answer N" instead of a page, and stores the question, the answer text, who answered and when. The review shows it in the Source column. Covers E5-7.', design: 'C7-Review.dc.html', personas: ['hub-owner', 'hub-editor', 'partner-reader'], size: 'M', state: 'Not started' },
      { id: 'E19-8', title: 'Draft panel and resume', detail: 'A live draft and seven-step progress sit beside the conversation on every step. The interview is saved per answer and resumes from the builder in a later session. Covers E5-6.', design: 'C2-Basics.dc.html', personas: ['hub-owner', 'hub-editor', 'ps-author'], size: 'M', state: 'Not started' },
      { id: 'E19-9', title: 'Review handoff', detail: 'At the end Aviator opens the review (E5-19) and summarises what is open: questions skipped, answers marked unsure, and answers that contradict each other.', design: 'C7-Review.dc.html', personas: ['hub-owner', 'hub-editor', 'ps-author'], size: 'S', state: 'Not started' },
      { id: 'E19-10', title: 'Attest and publish', detail: 'The guide preview carries "Authored by interview with Trading Grid Aviator". The author attests in place or sends to a hub signatory; sending depends on E6-2. Once attested the guide is live in Open Guides and served over MCP.', design: 'C8-Published.dc.html', personas: ['hub-owner', 'ps-author'], size: 'M', state: 'Not started' }
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

/* Design canvas for the new guide start and the Aviator interview flow. */
export const DESIGN_URL = 'https://claude.ai/artifact/8fA31FXAjyJrcx5ixUvrqi';

/* What the product publishes, and the test for anything new. */
export const SCOPE = {
  statement: 'EDI implementation guides and the business rules that go with them, as stated and attested by the hub.',
  tests: [
    'Changes rarely. Content that would need a new attested version more than a few times a year is out.',
    'Same for every partner. Anything specific to one partner or one relationship is out.',
    'A statement, not a state. Requirements and rules are in; status, progress and history are out.'
  ]
};

export const OUT_OF_SCOPE = [
  'Trading Grid entitlements and sign-on.',
  'Full theme control. Hub identity is a logo, one accent colour and a display name.',
  'Billing, plans and commercial metering. Every account is fully entitled.',
  'File validation, partner certification and mapping.',
  'Connectivity provisioning: AS2, SFTP, certificates.',
  'A platform-defined business process model. Process is declared by each hub as scenarios.',
  'An OpenText-maintained X12 standards library. Guide content comes from the hub, by document or by interview.',
  'Frequently changing reference data: routing codes, ship-to and facility lists, carrier tables.',
  'Supplier portal functions: partner accounts, onboarding status, acknowledgements, partner profiles.'
];
