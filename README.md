# ClientWeave

ClientWeave is an agent-native professional-services CPQ workspace. A buyer and
their browser agent work on one attributed scope, pricing is deterministic and
seller-controlled, and lead submission or booking requires a current direct
human confirmation.

## Why WebMCP

Service scoping is collaborative: people define business intent and retain the
final say, while agents can efficiently discover services, draft attributed
scope changes, calculate governed pricing, and find consultation availability.
ClientWeave registers browser-native WebMCP tools through
`document.modelContext.registerTool()` (with an older-browser fallback). The
tools call the same authenticated, audited HTTP boundaries as the ordinary UI.
An agent cannot confirm on a person's behalf: `finalize_confirmed_scope` only
succeeds after the person directly confirms the exact current summary in the
page.

The six registered tools are `discover_services`, `create_scope`,
`update_scope`, `price_scope`, `find_consultation_slots`, and
`finalize_confirmed_scope`. Their browser registration is in
[`src/webmcp/browser-tools.ts`](src/webmcp/browser-tools.ts), and the
registration component is in
[`src/components/shared/webmcp-registration.tsx`](src/components/shared/webmcp-registration.tsx).

## WebMCP testing

1. Deploy this application over HTTPS and open its live URL in a WebMCP-enabled
   Chrome or ChatGPT in-app browser.
2. Start a buyer journey, choose a service, and open the private scope URL.
3. Ask the agent to discover services, update the scope, calculate pricing, and
   find availability. The browser exposes structured tools; no DOM scraping is
   needed.
4. Review the final action in the ordinary page and directly click **I confirm
   this exact action**. Then the agent may call `finalize_confirmed_scope` with
   the displayed summary data. Without that human action, finalization returns
   `HUMAN_CONFIRMATION_REQUIRED` and makes no consequential change.

Buyer testing requires no login. Owner configuration requires local or hosted
Supabase credentials configured from `.env.local.example`; never commit those
credentials. See [the submission guide](docs/hackathon-submission.md) for the
demo script and final external submission steps.

## Local operation

Use Node 24 and pnpm 10. Copy `.env.local.example` to `.env.local`, configure
local Supabase credentials, then run `pnpm install`, `supabase start`, apply the
migrations and seed, and start the app with `pnpm dev`.

Useful checks are `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`,
and `pnpm build`. The full CI gate is `pnpm validate` once database, browser,
and WebMCP services are available.

## Architecture

`src/modules` holds pure domain rules and application use cases. App Router,
WebMCP, and repository adapters are deliberately thin. Prices use integer minor
units, canonical inputs, versioned rules, and per-line rounding. Public scope
capabilities grant only one expiring scope; they never confer workspace-owner
access. The agent registry contains exactly six operations and intentionally
does not expose human confirmation.

## Security and retention

User text is bounded data, never executable policy. Scope secrets are hashed;
cookies are secure/HTTP-only; CSP, origin checking, no-referrer, and no-store
headers protect public and private workflows. Draft scopes expire after 30 days.
The authenticated daily retention route expires drafts and revokes participants,
then removes finalized scope records after the owning workspace's disclosed
`retention_days` period while preserving a workspace-level deletion audit event.

## License

ClientWeave is released under the [MIT License](LICENSE).
