# Quickstart Validation Guide: ClientWeave

This guide describes the runnable validation surface the implementation must provide. It proves the feature end to end; implementation sequencing belongs in `tasks.md`.

## Prerequisites

- Node.js 24.x and Corepack
- pnpm 11.x
- Docker-compatible container runtime
- Supabase CLI 2.x
- Chromium installed by the test setup for the optional WebMCP suite

Use the exact versions pinned by the repository's toolchain files and lockfile. Local PostgreSQL must match the hosted PostgreSQL 17 target.

## Local setup

From the repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.local.example .env.local
supabase start
pnpm db:reset
pnpm dev
```

`pnpm db:reset` must apply checked-in migrations, create the fictional workspace and owner, publish exactly three seeded services, and create native consultation availability. It prints local URLs and non-production owner sign-in details; secrets must not be committed.

Expected startup state:

- Buyer site is available at `http://localhost:3000`.
- Owner console is available at `http://localhost:3000/owner`.
- Three active services collectively include required and optional intake fields, base/quantity/add-on/conditional rules, a timing conflict, incompatible options, and an under-budget tradeoff.
- The tool inspector declares exactly the six capabilities in [contracts/agent-capabilities.md](contracts/agent-capabilities.md).

If the application is not yet implemented, these commands are the acceptance target for the implementation phase rather than expected to work during planning.

## Scenario A: Complete ordinary buyer journey with no agent

1. Open a private browser window with WebMCP/agent integration disabled and visit the buyer site.
2. Enter a website-project goal, maximum budget, and desired delivery date. Confirm only active services appear with comparable price and delivery fit.
3. Select the seeded website service and create a scope. Reload the page and confirm the same draft returns from its scope-bound session.
4. Request a quote before completing intake. Confirm no final total appears and each missing field is named.
5. Complete the required intake in the ordinary UI. Confirm goal, budget, delivery, each assumption, and every answer show their current actor and update time, and that an incompatible option or impossible date produces an actionable conflict.
6. Resolve conflicts and request a quote. Confirm currency, min/max, ordered line items, assumptions, rule-set version, and delivery constraints are visible.
7. Change a price-affecting value. Confirm the old quote is visibly stale and finalization is unavailable until a new quote is produced.
8. Select a currently available consultation slot and enter only the contact details required for the next step.
9. Review the server-authored final summary and verify it contains the complete attributed scope snapshot, service requirements/constraints, current eligible quote total and line items, contact, action, optional slot, notices, and expiry. Change the slot or contact after reviewing it and confirm the prior confirmation is invalid. Review again and explicitly confirm the current summary.
10. Finalize. Confirm one qualified lead and one booking are shown. Refresh/retry with the same request and confirm the same result returns without duplicates.
11. Sign into the owner console. Confirm the lead view presents the confirmed scope/provenance, quote snapshot/rule version, contact, booking, and chronological human/agent/system history together.

Expected outcome: the journey completes without agent support, no name/email is requested before finalization, and no consequential state appears until the current human confirmation is consumed.

## Scenario B: Shared human and browser-agent scope

Run the dedicated browser suite, which starts Chromium with the required experimental WebMCP support:

```bash
pnpm test:webmcp
```

The suite must:

1. discover exactly `discover_services`, `create_scope`, `update_scope`, `price_scope`, `find_consultation_slots`, and `finalize_confirmed_scope`;
2. prove that no confirmation tool is registered;
3. have the agent create and populate a scope, then verify goal, budget, delivery, assumptions, and answers show current `Agent` provenance and update times on the visible canvas;
4. have the human change deadline/budget and verify the agent sees the same incremented revision within two seconds;
5. have the agent apply an approved tradeoff and re-price using the same durable state;
6. verify discovery, pricing, and availability checks do not create a lead, booking, or slot change;
7. verify unconfirmed agent finalization returns `CONFIRMATION_REQUIRED` and changes no business state; and
8. after a direct human confirmation in the page, allow the agent to invoke finalization and verify exactly one result.

Expected outcome: the visible page and tool results converge on one revisioned scope, with provenance and side effects matching the capability contract.

## Scenario C: Owner configuration and quote history

1. In the owner console, create a draft template-based service and configure required intake, all supported pricing rule types, constraints, incompatible options, and consultation slots.
2. Attempt to publish an invalid/incomplete configuration and confirm actionable validation prevents activation.
3. Publish the valid service and confirm it becomes discoverable; deactivate it and confirm new discovery hides it.
4. Activate pricing rule set v1, produce a buyer quote, then publish a changed v2.
5. Confirm a new quote uses v2 and the previous quote remains byte-for-byte unchanged and reproducible with v1 and its evaluator version.
6. Block a previously available slot and confirm it disappears from new availability results and cannot be finalized.

Expected outcome: new buyer results use only published active configuration, while historical commercial records remain intact.

## Automated verification commands

Run the full validation pipeline:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm contract:check
pnpm test:unit
pnpm test:property
pnpm test:integration
pnpm test:concurrency
pnpm test:e2e
pnpm test:webmcp
pnpm test:redaction
```

Required evidence by command:

| Command | Expected proof |
|---|---|
| `pnpm contract:check` | Authoritative Zod schemas generate valid OpenAPI/JSON Schema/client artifacts without drift; exchange and service-detail helper routes are present; exact six tools and the four state effects match; canonical HTTP If-Match/WebMCP expected_revision translation, complete attributed scope responses, current-final-quote summaries, RFC 9457 errors, and unknown-field rejection validate. |
| `pnpm test:unit` | Scope and assumption normalization/diffing, all-material provenance, missing/conflict detection, deterministic Unicode keyword matching, all four pricing rule types, per-line nearest-minor-unit percentage rounding with exact halves away from zero, deterministic order, quote/confirmation fingerprints, and state transitions pass. |
| `pnpm test:property` | Random input/rule insertion order and JSON key order cannot change quote totals or line items; totals reconcile to ordered line items. |
| `pnpm test:integration` | Real PostgreSQL migrations, active-only discovery, one-scope access, owner workspace authorization, quote history, confirmation invalidation, idempotent retries, atomic rollback, retention, realtime authorization, and audit events pass. |
| `pnpm test:concurrency` | At least 50 independent connections contend for one slot; exactly one booking and its one lead succeed, all losers have no partial lead/booking, and retries return the recorded result. |
| `pnpm test:e2e` | Chromium, Firefox, and WebKit complete the ordinary journey; provenance is legible; no-agent graceful degradation works; owner sees finalized handoff within five seconds. |
| `pnpm test:webmcp` | Experimental Chromium discovers/invokes exactly six tools and honors the separate human-confirmation boundary. |
| `pnpm test:redaction` | Credentials, raw scope capabilities, cookies, CSRF values, contact details, unrelated customers, and internal exceptions are absent from errors, logs, realtime messages, and inspector output. |

The complete CI shortcut may wrap the same stages:

```bash
pnpm validate
```

Expected outcome: zero failing gates. The concurrency and no-agent E2E stages are mandatory, not optional smoke checks.

## Pre-release cohort evidence

Record the protocol and anonymized raw results in `specs/001-agent-service-cpq/usability-report.md`:

- Run the complete ordinary journey with 10 first-time buyers using a fresh seed per participant. At least 9 must finish in under 3 minutes, at least 9 must finish without assistance, and at least 9 must correctly identify human-versus-agent provenance.
- Run the complete owner configuration scenario with 5 first-time owner-role participants using a fresh template per participant. All 5 must publish the required service and availability in under 15 minutes.
- Run the version-controlled corpus of 20 agent journeys spanning all six capabilities and required recovery paths. At least 19 must choose valid capabilities and reach the expected terminal state.
- Measure collaboration with exactly 100 alternating human/agent updates across 10 fresh scopes and require at least 95 updates to become visible to the other client within two seconds of commit acknowledgement. Measure owner visibility across 20 fresh-scope finalizations and require at least 19 to appear within five seconds.
- Use a monotonic clock for elapsed durations, record commit-acknowledgement and observation timestamps, and exclude exactly one declared warm-up run per browser/environment before collecting either performance sample.
- Treat any unintended lead, booking, or availability mutation during read-only or unconfirmed activity as an SC-005 failure even if the aggregate agent threshold passes.
- Retain participant criteria, environment, timing method, raw durations/outcomes, assistance events, provenance answers, agent corpus version, and failure notes without unnecessary personal data.

## Focused failure checks

The following cases must each return a stable problem code and leave no partial consequential state:

- incomplete or invalid typed answer;
- unsupported or incompatible option;
- requested timing outside service constraints;
- budget below the priced range;
- stale HTTP `If-Match` or WebMCP `expected_revision` after adapter translation;
- stale or superseded quote;
- missing, expired, replayed, or summary-mismatched human confirmation;
- selected slot blocked/booked after discovery;
- reused idempotency key with a different request;
- invalid, expired, revoked, or cross-scope capability;
- anonymous request to an owner operation or owner request for another workspace;
- prompt-like text, executable-looking rule text, HTML/script, bidi control characters, or oversized Unicode input; and
- configured quota exceeded, returning `429` with `Retry-After`.

Use [data-model.md](data-model.md) for the expected transaction/integrity boundaries and [contracts/openapi.yaml](contracts/openapi.yaml) for request/response details instead of duplicating them here.
