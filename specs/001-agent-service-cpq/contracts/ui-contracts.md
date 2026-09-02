# UI Contract: Buyer and Owner Workspaces

The ordinary web interface is a complete first-class adapter over the same domain use cases as the HTTP and agent interfaces. Browser-agent support may enhance the page but must not hide, replace, or unlock ordinary controls.

## Shared interaction rules

- Every page has usable loading, empty, validation, conflict, stale, expired, unauthorized, rate-limited, and retry states.
- Server state remains authoritative. Mutations use the last-seen revision; a collision refetches and explains what changed before a retry.
- Human, agent, imported, and system provenance is displayed beside the current value, not only in a separate log.
- Price ranges always show currency, ordered line items, assumptions, rule version, and the non-binding planning-range notice.
- Consequential controls use the current server-authored summary. Changing scope, quote, slot, contact, or action returns the user to review and removes finalization eligibility.
- Keyboard navigation, visible focus, programmatic labels/errors, live-region announcements for remote updates, and color-independent status cues are required.
- Responsive layouts preserve the scope, quote, and approval information hierarchy on small screens; no core action depends on hover or a tool inspector.

## Buyer routes

### Catalog and discovery: `/`

**Inputs**: Need/goal, optional maximum budget, optional desired delivery date.

**Visible output**: Active services only, with description, base range, delivery range, inclusions, likely fit reasons, and conflicts/tradeoffs. A buyer can compare and select without an agent.

**Prohibited behavior**: Discovery cannot create a scope, lead, booking, or availability hold until the buyer explicitly chooses to start a draft.

### Service detail and scope creation: `/services/[slug]`

**Visible output**: Published service version, inclusions, add-ons, intake fields, pricing/delivery caveats, and create-draft action.

**Create action**: Starts one 30-day draft and redirects to the fragment-secret bootstrap URL. Name/email are absent.

### Shared scope canvas: `/s/[scopeRef]`

The bootstrap exchanges the fragment secret, clears it from browser history, and establishes a one-scope session before rendering data.

The canvas contains:

- service and goal summary;
- typed requirements, budget, target timing, and assumptions;
- provenance and last-update time for each current value;
- missing requirements and actionable conflicts;
- quote panel with `NONE`, `INCOMPLETE`, `CONFLICTED`, `CURRENT`, or visibly `STALE` state;
- current consultation availability after a valid quote;
- finalization panel with minimal contact fields, selected action, selected slot, final summary, explicit human confirmation, and result; and
- collapsible tool inspector with exactly six capability definitions and sanitized recent outcomes for this scope.

Remote revision notifications refetch the scope and announce the changed fields within the two-second target. A local dirty field is never silently overwritten; the user reviews the conflict.

### Final summary and confirmation

The confirmation view renders the exact server-authored:

- current requirements, constraints, and provenance;
- current quote/rule version and planning-range notice;
- selected slot in the workspace timezone, when applicable;
- normalized contact details;
- action text (`submit lead` or `submit lead and book consultation`); and
- disclosed retention notice.

The confirmation control is an ordinary direct human UI action and is never registered as an agent capability. After confirmation, the UI clearly identifies what will happen. If finalization fails due to stale state or slot contention, the page creates no partial-success impression and presents the fresh corrective step.

## Owner routes

All owner routes require a current authenticated member of the selected workspace. Wrong-workspace objects render the same not-found state as nonexistent objects.

### Service list/editor: `/owner/services` and `/owner/services/[serviceId]`

- List draft, active, and inactive offerings and their active version/rule version.
- Create/edit a draft containing description, base range, delivery range, inclusions, intake fields, typed rules, constraints, and incompatible options.
- Validate the complete graph before publication; arbitrary executable expressions are unavailable.
- Publishing creates immutable service/rule versions and switches future buyer discovery atomically.
- Deactivation removes the offering from new discovery without altering historical scopes or quotes.
- The UI prevents more than ten active offerings and explains incomplete configuration.

### Availability: `/owner/availability`

- Display/create/block native slots in the workspace timezone.
- Show booked state derived from the confirmed booking.
- Blocking or deleting an available slot affects only future finalization; a current booking remains historical.

### Lead list/detail: `/owner/leads` and `/owner/leads/[leadId]`

- New finalized leads appear within five seconds in the normal case.
- Detail presents confirmed requirements/constraints/provenance, quote snapshot and rule/evaluator version, minimal contact, booking, and chronological audit history in one handoff.
- Public scope credentials, secrets, unrelated scopes, and raw infrastructure logs never appear.

## Inspector contract

The scope inspector lists capability name, state effect, whether human confirmation is required, and recent invocation time/outcome/reason. It never displays raw arguments containing buyer prose/contact, bearer tokens, cookies, CSRF/summary nonces, credentials, stack traces, or other scopes. Closing or disabling the inspector has no effect on ordinary workflow availability.

## UI acceptance evidence

- Playwright covers the entire no-agent buyer journey in Chromium, Firefox, and WebKit.
- Dedicated WebMCP tests verify visible scope convergence and provenance after each tool call.
- Accessibility checks cover keyboard-only completion, focus after errors/remote updates, accessible names, status announcements, and contrast.
- Timed E2E measurements record buyer completion, remote-update visibility, and owner lead-visibility success criteria.
