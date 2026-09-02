# Implementation Plan: ClientWeave Agent-Native Service CPQ

**Branch**: `001-agent-service-cpq` | **Date**: 2026-09-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-agent-service-cpq/spec.md`

## Summary

Build ClientWeave as a TypeScript modular monolith that gives buyers and browser agents one durable, attributable scope; evaluates immutable seller-owned pricing rules deterministically; and atomically creates a qualified lead and optional consultation only after current human confirmation. A Next.js ordinary web experience, versioned HTTP API, and progressive WebMCP adapter share the same domain use cases. Supabase PostgreSQL enforces version history, scope isolation, idempotency, and single-slot booking, while private realtime invalidations keep collaborating views current.

## Technical Context

**Language/Version**: TypeScript 6.x on Node.js 24 LTS; SQL for PostgreSQL 17 migrations

**Primary Dependencies**: Next.js 16.x, React 19.x, Zod 4.x, Drizzle ORM 0.45.x, `postgres.js` 3.x, Supabase JS 2.x/Auth/Realtime, TanStack Query 5.x, Tailwind CSS 4.x, React Hook Form 7.x, date-fns 4.x, Pino 10.x, OpenTelemetry

**Storage**: Supabase-managed PostgreSQL 17; hashed scope capabilities; immutable service/rule/quote snapshots; private Supabase Realtime Broadcast invalidations; no external CRM, calendar, or object store in MVP

**Testing**: Vitest 4.x unit/golden/integration tests, `fast-check` 4.x property tests, real PostgreSQL concurrency tests, Playwright 1.x cross-browser E2E, and Puppeteer 25.x WebMCP smoke/E2E

**Target Platform**: Responsive modern web browsers; Next.js Node functions on Vercel Pro and Supabase Pro in the same region; WebMCP-enabled Chromium as optional progressive enhancement

**Project Type**: Full-stack web application, one deployable modular monolith

**Performance Goals**: Complete scripted buyer-to-confirmed-consultation journey in under 3 minutes; 95% of collaborating updates visible within 2 seconds; 95% of new leads visible to the owner within 5 seconds; exactly one booking from 50 concurrent contenders; ordinary UI interactions target under 500 ms p95 excluding network variance and realtime refetch under 2 seconds p95

**Constraints**: Ordinary UI must provide the complete journey without agent/WebMCP support; prices use integer minor units and versioned pure evaluation; no client/agent total can override pricing; quote and confirmation eligibility are recomputed server-side; public access is restricted to one unexpired scope; human confirmation is separate from agent capabilities; finalization is atomic and idempotent; user prose is bounded untrusted data; abandoned drafts expire after 30 days; no payment, binding proposal, external calendar/CRM, or regulated-service workflow

**Scale/Scope**: MVP has one workspace and one owner, three realistic seeded services, 1–10 active offerings, anonymous shared scopes, native consultation slots, six agent capabilities, owner configuration and lead review, and 30-day draft retention; design supports multiple concurrent buyer scopes but does not introduce multi-brand/team complexity

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design.*

| Principle / gate | Planned compliance | Verification evidence | Status |
|---|---|---|---|
| I. Human Authority Over Consequential Actions | The ordinary UI exposes every discovery-through-booking action. WebMCP registers six capabilities but never the confirmation operation. Finalization consumes a current server-recorded human receipt bound to the exact summary. | No-agent Playwright journey; exact-six-tools contract test; unconfirmed/stale-confirmation tests prove zero lead/booking/slot changes. | PASS |
| II. Deterministic, Seller-Governed Commerce | Pure versioned evaluator consumes only canonical normalized scope values and immutable active rules; money uses minor units and ordered adjustments. Quote snapshots retain evaluator/rule/input fingerprints and complete outputs. | Golden and property pricing tests; client-total rejection; v1 quote replay after v2 publication; quote staleness tests. | PASS |
| III. One Shared and Attributable State | UI and agent adapters mutate the same revisioned scope. Each answer stores actor provenance. Private realtime messages invalidate/refetch the durable review model. | Revision-conflict integration tests; human/agent provenance E2E; cross-participant update latency measurement under two seconds. | PASS |
| IV. Least Privilege and Bounded Data | Scope capability exchange grants access to one scope; owner queries require active workspace membership; schemas reject unbounded/unknown input; prose is never executable; rate limits and output/log redaction apply at adapters. | Cross-scope/workspace authorization suite; fuzzed prompt-like text tests; quota tests; token/contact/log/inspector redaction scans. | PASS |
| V. Auditable Reliability | One PostgreSQL transaction and fixed lock order enforce current confirmation/quote/slot state. Unique lead, booking, and idempotency constraints prevent duplicates. Significant successes and rejections append audit events. | Fifty-contender real-DB test; same/different idempotency retry tests; injected rollback tests; required audit-event assertions. | PASS |
| Traceability | Modules, contracts, tests, and later tasks will cite FR/SC IDs and acceptance scenarios. No out-of-spec payment, contract, CRM, calendar, or regulated workflow is introduced. | Task generation and PR review traceability matrix. | PASS |
| Lowest effective test level | Pure pricing and validation use unit/property tests; persistence, authorization, and contention use real integration tests; full journeys use browser tests. | CI test-stage mapping in quickstart and future task list. | PASS |
| Historical compatibility | Published service/rule versions and issued quotes are append-only; migrations preserve historical snapshots and evaluator versions. | Migration tests and historical replay fixture across rule publication. | PASS |

### Post-design re-evaluation

Phase 1 artifacts preserve every gate:

- [data-model.md](data-model.md) makes service/rule/quote history immutable, defines separate pricing/finalization revisions, and places idempotency, confirmation, lead, booking, and audit writes in one transaction.
- [contracts/openapi.yaml](contracts/openapi.yaml) defines the public buyer/API boundary; [contracts/agent-capabilities.md](contracts/agent-capabilities.md) classifies side effects, keeps human confirmation out of agent tools, and specifies non-enumerating scope access and redaction.
- [quickstart.md](quickstart.md) validates both ordinary and agent journeys plus deterministic, authorization, historical, and 50-way contention gates.

No constitutional violation or exception is present. The Complexity Tracking table is intentionally empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-agent-service-cpq/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── agent-capabilities.md
│   ├── openapi.yaml
│   └── ui-contracts.md
└── tasks.md                 # Created later by $speckit-tasks, not this command
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (buyer)/
│   │   ├── services/
│   │   └── s/[scopeRef]/
│   ├── owner/
│   │   ├── services/
│   │   ├── availability/
│   │   └── leads/[leadId]/
│   └── api/v1/
│       ├── services/
│       ├── scopes/
│       └── owner/
├── components/
│   ├── buyer/
│   ├── owner/
│   └── shared/
├── modules/
│   ├── catalog/
│   ├── scope/
│   ├── pricing/
│   ├── availability/
│   ├── finalization/
│   ├── leads/
│   └── audit/
├── contracts/
│   ├── schemas/
│   ├── openapi/
│   └── problems/
├── webmcp/
│   ├── registry.ts
│   ├── adapters/
│   └── inspector.ts
├── db/
│   ├── client.ts
│   ├── schema/
│   └── repositories/
├── server/
│   ├── auth/
│   ├── authorization/
│   ├── rate-limit/
│   ├── realtime/
│   └── observability/
└── styles/

supabase/
├── config.toml
├── migrations/
└── seed.sql

tests/
├── unit/
├── property/
├── integration/
├── contract/
├── concurrency/
├── e2e/
├── webmcp/
└── fixtures/
```

**Structure Decision**: Use one Next.js deployable with domain modules under `src/modules`. Pages, HTTP handlers, and WebMCP adapters remain thin and call the same application use cases. PostgreSQL schema/repositories stay separate from pure pricing and validation code. Supabase migrations and deterministic fixtures are version-controlled. Test directories mirror the constitutional risk boundary so pricing, authorization, history, contention, ordinary UX, and WebMCP each have an explicit gate.

## Phase 0: Research outcomes

[research.md](research.md) resolves every initial technology and integration unknown. The decisive choices are:

1. Next.js/Node modular monolith rather than split services.
2. OpenAPI/Zod as the durable contract with WebMCP as optional progressive enhancement.
3. Supabase PostgreSQL/Auth/private Realtime for durable shared state and scope-bound participants.
4. Pure versioned pricing with integer money, canonical inputs, and derived staleness.
5. Server-authored human confirmation and one atomic, idempotent finalization transaction.
6. Real-database concurrency/authorization tests plus ordinary and agent browser suites.

All planning unknowns are resolved.

## Phase 1: Design outcomes

- **Domain model**: [data-model.md](data-model.md) defines entities, relationships, validation, state transitions, revision semantics, required constraints/indexes, and transaction boundaries.
- **External interfaces**: [contracts/openapi.yaml](contracts/openapi.yaml) defines public buyer operations and the six agent-backed operation IDs. [contracts/agent-capabilities.md](contracts/agent-capabilities.md) defines browser registration, state effects, human-only confirmation, error recovery, isolation, and inspector behavior. [contracts/ui-contracts.md](contracts/ui-contracts.md) defines the complete ordinary buyer and authenticated owner surfaces.
- **End-to-end validation**: [quickstart.md](quickstart.md) provides local prerequisites, environment setup, seed/run commands, ordinary and agent journeys, and required invariant test commands.

## Complexity Tracking

No constitutional violations require justification.
