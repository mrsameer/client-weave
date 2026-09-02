---

description: "Dependency-ordered implementation tasks for ClientWeave Agent-Native Service CPQ"
---

# Tasks: ClientWeave Agent-Native Service CPQ

**Input**: Design documents from `/specs/001-agent-service-cpq/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, and `.specify/memory/constitution.md`

**Tests**: Tests are required because the specification, quickstart, and constitution make deterministic pricing, authorization, human confirmation, idempotency, concurrency, historical replay, ordinary-browser completion, and agent-capability behavior release gates.

**Organization**: Tasks are grouped by user story so each increment has an explicit goal and independent test. Requirement and success-criterion IDs provide implementation traceability.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and does not depend on an incomplete task in the same phase
- **[Story]**: Maps the task to a user story (`US1` through `US5`)
- Every task names the exact file or directory it changes

## Constitution Traceability

| Principle | Implementation tasks | Verification |
|---|---|---|
| I. Human Authority Over Consequential Actions | T065–T084, T111, T118–T119 | Full ordinary and WebMCP journeys; no confirmation tool; unconfirmed and stale-confirmation attempts create no lead, booking, or slot mutation |
| II. Deterministic, Seller-Governed Commerce | T033–T045, T085–T097 | Golden/property pricing tests, client-total rejection, rule-version replay, and stale-quote tests |
| III. One Shared and Attributable State | T054–T064, T113, T120 | Revision-conflict integration tests, provenance E2E, two-second convergence measurements, and buyer-cohort provenance evidence |
| IV. Least Privilege and Bounded Data | T009, T017–T023, T029–T030, T101, T111, T114 | Cross-scope/workspace authorization, credential-mode separation, quota, hostile-input, and redaction tests |
| V. Auditable Reliability | T024, T055, T067–T068, T076–T077, T098, T118–T121 | Real-database atomicity, retry, contention, audit-event, complete release-journey, and final validation evidence |

No constitutional exceptions are approved for this feature.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the pinned TypeScript/Next.js toolchain and the repository structure described by the implementation plan.

- [ ] T001 Create the pnpm workspace scripts and pin Node.js 24, Next.js 16, React 19, TypeScript 6, and runtime/test dependencies in package.json
- [ ] T002 [P] Configure strict TypeScript and Next.js Node-runtime defaults in tsconfig.json and next.config.ts
- [ ] T003 [P] Configure ESLint, Prettier, and ignore rules in eslint.config.mjs, .prettierrc.json, and .prettierignore
- [ ] T004 [P] Define validated local environment placeholders without secrets in .env.local.example and src/server/env.ts
- [ ] T005 [P] Configure the local PostgreSQL 17 Supabase project in supabase/config.toml
- [ ] T006 [P] Configure Vitest projects, Playwright browsers, and Puppeteer WebMCP execution in vitest.config.ts, playwright.config.ts, and tests/webmcp/puppeteer.config.ts
- [ ] T007 [P] Create the responsive App Router root layout and shared Tailwind theme in src/app/layout.tsx and src/styles/globals.css
- [ ] T008 [P] Document domain/application/adapter dependency boundaries in src/modules/README.md

**Checkpoint**: The application, database tooling, and all planned test runners can be installed and invoked.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared contracts, persistence, authorization, security, audit, realtime, and test foundations required by every story.

**Critical**: No user-story implementation begins until this phase is complete.

- [ ] T009 Implement the authoritative bounded Zod request, response, capability, and RFC 9457 schemas with unknown-property rejection in src/contracts/schemas/ and src/contracts/problems/problem-details.ts
- [ ] T010 Generate OpenAPI 3.1, JSON Schema, and client types from the authoritative Zod schemas and fail CI on artifact drift in scripts/generate-contracts.ts, scripts/check-contracts.ts, specs/001-agent-service-cpq/contracts/openapi.yaml, and src/contracts/openapi/generated.ts
- [ ] T011 [P] Implement pooled runtime and direct migration PostgreSQL clients in src/db/client.ts and drizzle.config.ts
- [ ] T012 [P] Define Workspace, WorkspaceMember, ServiceOffering, ServiceVersion, ScopeField, PricingRuleSet, PricingRule, and ServiceConstraint tables in src/db/schema/catalog.ts
- [ ] T013 [P] Define ScopeSession attribution columns, ScopeParticipant, ordered ScopeAssumption, ScopeAnswer, and immutable Quote tables in src/db/schema/scopes.ts
- [ ] T014 [P] Define AvailabilitySlot, HumanConfirmation, IdempotencyRecord, QualifiedLead, and Booking tables in src/db/schema/finalization.ts
- [ ] T015 [P] Define append-only AuditEvent and sanitized AgentInvocation tables with the exact READ_ONLY, DRAFT_MUTATION, DERIVED_RECORD_WRITE, and CONSEQUENTIAL_WRITE state-effect catalog in src/db/schema/audit.ts
- [ ] T016 Create PostgreSQL constraints, indexes, UUIDv7 support, and immutable-history protections for all foundational tables in supabase/migrations/0001_domain_schema.sql
- [ ] T017 Add one-scope participant policies and workspace-member owner policies in supabase/migrations/0002_authorization_policies.sql
- [ ] T018 [P] Implement Supabase owner and anonymous authentication clients plus owner sign-in, sign-out, and session refresh in src/server/auth/supabase-server.ts, src/server/auth/supabase-browser.ts, src/app/owner/login/page.tsx, and src/app/owner/auth/actions.ts
- [ ] T019 Implement the contracted fragment-secret exchange, keyed token hashing, scope-bound `__Host-clientweave_scope` cookie issuance, CSRF binding, participant creation, and fragment clearing in src/server/auth/scope-capability.ts and src/app/api/v1/scopes/exchange/route.ts
- [ ] T020 [P] Implement scope and workspace object-level authorization guards with non-enumerating failures in src/server/authorization/scope-access.ts and src/server/authorization/workspace-access.ts
- [ ] T021 [P] Implement safe RFC 9457 error mapping and public correlation IDs in src/contracts/problems/to-problem-response.ts
- [ ] T022 [P] Implement route/IP plus scope/operation database rate-limit enforcement in src/server/rate-limit/public-rate-limit.ts and supabase/migrations/0003_rate_limits.sql
- [ ] T023 [P] Configure redacted Pino logs and OpenTelemetry request tracing in src/server/observability/logger.ts and src/server/observability/tracing.ts
- [ ] T024 [P] Implement append-only audit event creation with closed action/outcome catalogs in src/modules/audit/application/append-audit-event.ts and src/modules/audit/domain/audit-event.ts
- [ ] T025 [P] Implement private scope revision invalidation publishing and subscription authorization as the sole realtime transport in src/server/realtime/scope-broadcast.ts and supabase/migrations/0004_scope_broadcast.sql
- [ ] T026 [P] Add the TanStack Query browser provider and authorized API client boundary in src/components/shared/app-providers.tsx and src/contracts/http/client.ts
- [ ] T027 [P] Create deterministic entity, clock, pricing-rule, scope, and auth factories in tests/fixtures/factories.ts
- [ ] T028 Add real-PostgreSQL migration and invariant coverage for all required constraints in tests/integration/db/schema.test.ts
- [ ] T029 Add owner sign-in/sign-out/session refresh plus cross-scope, expired/revoked capability, anonymous-owner, and wrong-workspace authorization coverage in tests/integration/auth/authorization.test.ts
- [ ] T030 Add RFC 9457 envelope, contracted exchange/service-detail routes, unknown-field rejection, quota, bearer/cookie separation, canonical If-Match handling, bearer rejection on human confirmation, and secret-free error contract coverage in tests/contract/foundation.contract.test.ts

**Checkpoint**: Migrations apply cleanly; shared security and observability boundaries work; user stories may now proceed according to the dependency graph.

---

## Phase 3: User Story 1 - Discover, Scope, and Price a Service (Priority: P1) MVP

**Goal**: Let a buyer or agent discover an active service, create a durable typed scope, identify missing/conflicting inputs, and receive a deterministic seller-governed line-item price range. (FR-001–FR-007, FR-010–FR-017, FR-030–FR-035)

**Independent Test**: Reset the seeded agency, discover the website package for a stated budget and deadline, create and reload a scope, prove an incomplete scope has no final total, fill its intake, and verify the visible quote exactly matches the configured rules and remains reproducible.

### Tests for User Story 1

> Write these tests first and confirm they fail before implementing the story.

- [ ] T031 [P] [US1] Add contract tests for active-only discovery with explicit inclusions/add-ons/intake/constraints, attributed scope creation/review including assumptions and null values, deterministic quote responses, and safe validation problems in tests/contract/discovery-scope-pricing.contract.test.ts
- [ ] T032 [P] [US1] Add unit tests for bounded assumption and typed-answer normalization, required-field detection, constraints, bounded hostile prose, and actionable issue ordering in tests/unit/scope/validation.test.ts
- [ ] T033 [P] [US1] Add golden tests for base, quantity, add-on, conditional, priority, per-line nearest-minor-unit percentage rounding with exact halves away from zero, and rounded line-item reconciliation in tests/unit/pricing/evaluator.test.ts and tests/fixtures/pricing-golden.json
- [ ] T034 [P] [US1] Add fast-check properties proving input key order and rule insertion order cannot change quote totals or line items in tests/property/pricing-determinism.test.ts
- [ ] T035 [P] [US1] Add real-database tests for active-only discovery, 30-day durable scopes, quote deduplication, active rule selection, and immutable quote snapshots in tests/integration/catalog-scope-pricing.test.ts
- [ ] T036 [P] [US1] Add the no-agent discovery-through-current-quote browser journey with reload, incomplete, conflict, and under-budget states in tests/e2e/buyer-scope-price.spec.ts

### Implementation for User Story 1

- [ ] T037 [P] [US1] Implement catalog entities plus Unicode NFKC/lowercase distinct-token need matching ordered by eligibility, descending overlap, and slug, with explicit budget/delivery fit evaluation in src/modules/catalog/domain/service.ts and src/modules/catalog/domain/match-service.ts
- [ ] T038 [P] [US1] Implement typed scope normalization, missing-field detection, and service-constraint evaluation in src/modules/scope/domain/normalize-scope.ts and src/modules/scope/domain/validate-scope.ts
- [ ] T039 [P] [US1] Implement canonical JSON hashing, integer-money arithmetic, stable rule ordering, per-line percentage rounding to nearest minor unit with exact halves away from zero, rounded-line summation, and versioned pricing evaluation in src/modules/pricing/domain/canonicalize.ts and src/modules/pricing/domain/evaluator-v1.ts
- [ ] T040 [P] [US1] Implement workspace-scoped active catalog reads in src/db/repositories/catalog-repository.ts
- [ ] T041 [P] [US1] Implement authorized scope creation, ordered assumption and answer persistence, trusted actor/time attribution for every material value, expiry, and full attributed review-model reads in src/db/repositories/scope-repository.ts
- [ ] T042 [P] [US1] Implement immutable quote persistence, input-hash deduplication, and current/stale derivation in src/db/repositories/quote-repository.ts
- [ ] T043 [US1] Implement the discover-services use case with eligibility-first/overlap/slug ordering, stable budget and delivery fit/conflict reasons, active-service visibility, and no business-state mutation in src/modules/catalog/application/discover-services.ts
- [ ] T044 [US1] Implement create-scope and get-current-scope use cases with server-derived actor/time provenance for goal, budget, delivery, assumptions, and answers plus validation output in src/modules/scope/application/create-scope.ts and src/modules/scope/application/get-scope-review.ts
- [ ] T045 [US1] Implement price-scope using a consistent stored snapshot, current immutable rules, evaluator pinning, and audit recording in src/modules/pricing/application/price-scope.ts
- [ ] T046 [P] [US1] Implement the contracted public discovery and service-detail HTTP handlers in src/app/api/v1/services/route.ts and src/app/api/v1/services/[slug]/route.ts
- [ ] T047 [US1] Implement scope creation and authorized current-scope HTTP handlers in src/app/api/v1/scopes/route.ts and src/app/api/v1/scopes/current/route.ts
- [ ] T048 [US1] Implement the deterministic quote HTTP handler in src/app/api/v1/scopes/current/quotes/route.ts
- [ ] T049 [P] [US1] Build ordinary catalog comparison and service-detail intake surfaces in src/app/(buyer)/page.tsx, src/app/(buyer)/services/[slug]/page.tsx, and src/components/buyer/service-card.tsx
- [ ] T050 [US1] Build the fragment-bootstrap, durable scope review, validation, and quote panels in src/app/(buyer)/s/[scopeRef]/page.tsx, src/components/buyer/scope-canvas.tsx, and src/components/buyer/quote-panel.tsx
- [ ] T051 [P] [US1] Implement shared-browser capability registration plus discover, create, and price adapters in src/webmcp/registry.ts, src/webmcp/adapters/discover-services.ts, src/webmcp/adapters/create-scope.ts, and src/webmcp/adapters/price-scope.ts
- [ ] T052 [US1] Seed one workspace, one owner, exactly three active services, all four pricing rule types, required intake, timing/incompatibility conflicts, an under-budget tradeoff, and initial slots in supabase/seed.sql
- [ ] T053 [US1] Wire the generated contract client into buyer and WebMCP adapters and make pnpm contract:check cover the three US1 capabilities in src/contracts/http/buyer-client.ts and scripts/check-agent-capabilities.ts

**Checkpoint**: User Story 1 is independently usable without an agent and exposes matching agent capabilities over the same use cases. This is the suggested MVP implementation checkpoint, not a release candidate until US3 and the complete release-journey gates pass.

---

## Phase 4: User Story 2 - Collaborate on One Visible Scope (Priority: P2)

**Goal**: Keep humans and agents on one revisioned scope, show current-value provenance, surface conflicts, and invalidate/recalculate prices after material edits. (FR-008–FR-010, FR-015, FR-017, FR-028; SC-007–SC-008)

**Independent Test**: Start from a seeded draft fixture, apply an agent answer, edit the deadline as a human, then update an add-on as the agent; verify both clients converge within two seconds, provenance is correct, stale writes do not overwrite data, and price-affecting changes visibly stale the quote.

### Tests for User Story 2

- [ ] T054 [P] [US2] Add unit tests for general/pricing/finalization revision increments, edit-then-revert staleness, per-value goal/budget/delivery/assumption/answer provenance, assumption diffing, and mutation issue output in tests/unit/scope/mutation.test.ts
- [ ] T055 [P] [US2] Add real-database tests for optimistic revision conflicts, atomic answer/audit writes, stale quote derivation, and private topic authorization in tests/integration/scope-collaboration.test.ts
- [ ] T056 [P] [US2] Add two-client browser coverage for visible provenance, dirty-field collision handling, accessible announcements, and two-second convergence in tests/e2e/scope-collaboration.spec.ts
- [ ] T057 [P] [US2] Add WebMCP coverage for agent updates, human corrections, approved tradeoffs, and shared revision convergence in tests/webmcp/update-scope.spec.ts

### Implementation for User Story 2

- [ ] T058 [P] [US2] Implement allowlisted typed scope patch validation and revision-impact classification in src/modules/scope/domain/scope-patch.ts
- [ ] T059 [US2] Implement locked optimistic scope mutation, assumption diffing, trusted actor/time attribution for every changed material value, revision increments, confirmation invalidation, audit append, and post-commit invalidation in src/modules/scope/application/update-scope.ts
- [ ] T060 [US2] Add canonical quoted If-Match precondition handling without a duplicate body revision and return the complete attributed review model from src/app/api/v1/scopes/current/route.ts
- [ ] T061 [P] [US2] Implement authorized realtime invalidation subscription with refetch and polling fallback in src/server/realtime/scope-subscription.ts and src/components/buyer/use-live-scope.ts
- [ ] T062 [US2] Build goal, budget, delivery, bounded-assumption, and typed-answer editors with per-value actor/time labels, stale-quote cues, tradeoff controls, and local collision review in src/components/buyer/scope-editor.tsx and src/components/buyer/provenance-badge.tsx
- [ ] T063 [US2] Add live-region announcements and focus restoration for remote changes and revision errors in src/components/buyer/scope-live-status.tsx
- [ ] T064 [US2] Implement the update_scope adapter with expected_revision translated to HTTP If-Match, trusted actor derivation, complete attributed responses, and sanitized invocation recording in src/webmcp/adapters/update-scope.ts

**Checkpoint**: User Story 2 independently proves a shared attributable scope and safe conflict recovery using fixture-created scope state.

---

## Phase 5: User Story 3 - Approve and Book the Next Step (Priority: P3)

**Goal**: Show current consultation availability and require an exact, current, direct human confirmation before atomically and idempotently creating one lead and optional booking. (FR-018–FR-023, FR-028, FR-031–FR-032; SC-005–SC-006)

**Independent Test**: From a fixture-provided current quote, list slots without changing availability, render and directly confirm the server-authored summary, finalize once, retry to receive the same result, and prove unconfirmed/stale/contending requests create no partial state and at most one booking wins.

### Tests for User Story 3

- [ ] T065 [P] [US3] Add contract tests for availability, complete attributed final-summary snapshots with current eligible quote line items, human-only confirmation, required idempotency, and finalization problem codes in tests/contract/availability-finalization.contract.test.ts
- [ ] T066 [P] [US3] Add unit tests for quote eligibility, canonical final-summary hashes, confirmation invalidation, minimal contact, and finalization state transitions in tests/unit/finalization/eligibility.test.ts
- [ ] T067 [P] [US3] Add real-database tests for human-origin enforcement, stale summary/quote/slot rejection, same/different idempotency retries, fixed lock order, atomic rollback, and audit events in tests/integration/finalization.test.ts
- [ ] T068 [P] [US3] Add a 50-independent-connection single-slot contention test that asserts exactly one lead/booking and no loser partial state in tests/concurrency/single-slot-finalization.test.ts
- [ ] T069 [P] [US3] Add ordinary-browser availability, contact, summary-change invalidation, direct confirmation, booking, and retry coverage in tests/e2e/buyer-finalization.spec.ts
- [ ] T070 [P] [US3] Add WebMCP tests proving no confirmation tool exists, read-only availability has no side effects, unconfirmed finalization fails, and post-human-confirmation finalization succeeds once in tests/webmcp/finalization-boundary.spec.ts

### Implementation for User Story 3

- [ ] T071 [P] [US3] Implement timezone-aware currently-bookable slot filtering with no hold side effect in src/modules/availability/domain/bookable-slots.ts
- [ ] T072 [P] [US3] Implement workspace-scoped slot reads and conditional locked booking claims in src/db/repositories/availability-repository.ts
- [ ] T073 [US3] Implement find-consultation-slots with current-quote eligibility checks in src/modules/availability/application/find-consultation-slots.ts
- [ ] T074 [P] [US3] Implement canonical server-authored final summaries containing the complete attributed scope snapshot, service constraints, current eligible quote totals/line items, selection details, notices, and short-lived nonces in src/modules/finalization/domain/final-summary.ts
- [ ] T075 [US3] Implement direct-human confirmation recording with trusted-origin enforcement and current revision/hash checks in src/modules/finalization/application/record-human-confirmation.ts
- [ ] T076 [P] [US3] Implement idempotency ledger claim/replay semantics and workspace-scoped lead/booking writes in src/db/repositories/finalization-repository.ts
- [ ] T077 [US3] Implement the fixed-lock-order finalization transaction, invariant rechecks, retryable transaction handling, audit events, and stored response in src/modules/finalization/application/finalize-confirmed-scope.ts
- [ ] T078 [P] [US3] Implement the read-only availability HTTP handler in src/app/api/v1/scopes/current/availability/route.ts
- [ ] T079 [US3] Implement final-summary and trusted human-confirmation HTTP handlers in src/app/api/v1/scopes/current/final-summary/route.ts and src/app/api/v1/scopes/current/human-confirmations/route.ts
- [ ] T080 [US3] Implement the idempotent finalization HTTP handler in src/app/api/v1/scopes/current/finalizations/route.ts
- [ ] T081 [P] [US3] Build timezone-aware slot selection with unavailable-slot recovery in src/components/buyer/availability-picker.tsx
- [ ] T082 [US3] Build minimal contact, exact rendering of the server-returned complete attributed final review, direct confirmation, pending/result, and safe failure states in src/components/buyer/finalization-panel.tsx and src/components/buyer/final-summary.tsx
- [ ] T083 [P] [US3] Implement find_consultation_slots and finalize_confirmed_scope adapters without a confirmation adapter in src/webmcp/adapters/find-consultation-slots.ts and src/webmcp/adapters/finalize-confirmed-scope.ts
- [ ] T084 [US3] Complete exact-six capability schema/state-effect validation and sanitized per-invocation recording in src/webmcp/registry.ts and scripts/check-agent-capabilities.ts

**Checkpoint**: User Story 3 independently proves the human authority boundary, all-or-nothing finalization, retry safety, and single-slot exclusivity.

---

## Phase 6: User Story 4 - Configure the Sales Surface (Priority: P4)

**Goal**: Let the authenticated owner author, validate, publish, activate/deactivate, and version services, pricing rules, constraints, and native availability used by future buyer results. (FR-024–FR-026; SC-009, SC-011)

**Independent Test**: Authenticate as the seeded owner, create a template-based service with all rule types and slots, reject an incomplete publication, publish the valid graph, verify discovery changes immediately, publish v2, reproduce an unchanged v1 quote, and block a slot so it disappears from new results.

### Tests for User Story 4

- [ ] T085 [P] [US4] Add unit tests for complete service-graph validation, typed rule operands, active-offering limits, immutable version increments, and executable-text rejection in tests/unit/catalog/configuration.test.ts
- [ ] T086 [P] [US4] Add real-database tests for workspace authorization, atomic publication, activation/deactivation, rule pointer changes, historical quote replay, and slot blocking in tests/integration/owner-configuration.test.ts
- [ ] T087 [P] [US4] Add owner-browser coverage for the under-15-minute template configuration, actionable invalid publication, catalog visibility, v2 history, and slot blocking in tests/e2e/owner-configuration.spec.ts

### Implementation for User Story 4

- [ ] T088 [P] [US4] Implement closed service, field, pricing-rule, and constraint draft schemas plus complete-graph validation in src/modules/catalog/domain/service-configuration.ts
- [ ] T089 [P] [US4] Implement service/version/rule publication and activation persistence with immutable snapshots and locked active-pointer switches in src/db/repositories/configuration-repository.ts
- [ ] T090 [P] [US4] Implement owner slot creation, overlap validation, blocking, and booked-history protection in src/modules/availability/application/manage-availability.ts
- [ ] T091 [US4] Implement authenticated create/edit/publish/activate/deactivate service use cases with workspace scoping and audit events in src/modules/catalog/application/manage-services.ts
- [ ] T092 [P] [US4] Implement owner service and availability server actions with safe not-found behavior in src/app/owner/services/actions.ts and src/app/owner/availability/actions.ts
- [ ] T093 [P] [US4] Build the owner service list and template-based draft editor shell in src/app/owner/services/page.tsx, src/app/owner/services/[serviceId]/page.tsx, and src/components/owner/service-editor.tsx
- [ ] T094 [US4] Build typed intake-field, pricing-rule priority, delivery/incompatibility constraint, and publication validation editors in src/components/owner/scope-field-editor.tsx, src/components/owner/pricing-rule-editor.tsx, and src/components/owner/constraint-editor.tsx
- [ ] T095 [P] [US4] Build the timezone-aware availability management surface in src/app/owner/availability/page.tsx and src/components/owner/availability-manager.tsx
- [ ] T096 [US4] Add historical quote replay through retained evaluator versions and persisted rule/input fingerprints in src/modules/pricing/application/replay-quote.ts and src/modules/pricing/domain/evaluator-registry.ts
- [ ] T097 [US4] Surface active service/rule versions and historical preservation notices in src/components/owner/version-history.tsx

**Checkpoint**: User Story 4 independently changes only future catalog, price, and availability results while preserving historical commercial records.

---

## Phase 7: User Story 5 - Review Qualified Leads and Agent Activity (Priority: P5)

**Goal**: Give the owner one authorized handoff containing confirmed scope/provenance, quote, minimal contact, booking, and chronological activity, while the buyer sees an exact-six-tool sanitized inspector. (FR-026–FR-029; SC-010)

**Independent Test**: Load a fixture-finalized scope as the owner and verify the full handoff and ordered human/agent/system history appear together; as the scope participant, open the inspector and verify exact capability metadata and recent outcomes without credentials, contact payloads, or unrelated data.

### Tests for User Story 5

- [ ] T098 [P] [US5] Add real-database tests for workspace-scoped lead list/detail projections, chronological audit sequences, and under-five-second finalized-lead visibility in tests/integration/lead-review.test.ts
- [ ] T099 [P] [US5] Add contract tests for exact-six inspector metadata, the exact four-value state-effect catalog, current-scope invocation filtering, maximum result bounds, and secret/contact/error redaction in tests/contract/inspector.contract.test.ts
- [ ] T100 [P] [US5] Add owner-browser coverage for lead handoff contents, provenance, quote/rule replay metadata, booking, and ordered activity in tests/e2e/owner-lead-review.spec.ts
- [ ] T101 [P] [US5] Add redaction scans across logs, problems, realtime messages, inspector output, and owner/public response boundaries in tests/security/redaction.test.ts

### Implementation for User Story 5

- [ ] T102 [P] [US5] Implement workspace-scoped lead list/detail repositories with immutable scope, quote, contact, booking, and audit projections in src/db/repositories/lead-repository.ts
- [ ] T103 [P] [US5] Implement authorized lead handoff and chronological activity queries in src/modules/leads/application/get-lead-handoff.ts and src/modules/leads/application/list-leads.ts
- [ ] T104 [P] [US5] Implement scope-bound capability summaries and sanitized invocation queries in src/webmcp/inspector.ts
- [ ] T105 [US5] Implement the authorized inspector HTTP handler in src/app/api/v1/scopes/current/inspector/route.ts
- [ ] T106 [P] [US5] Build authenticated lead list and detail routes with non-enumerating wrong-workspace behavior in src/app/owner/leads/page.tsx and src/app/owner/leads/[leadId]/page.tsx
- [ ] T107 [US5] Build the unified lead handoff, provenance, quote snapshot, booking, and chronological action-history components in src/components/owner/lead-handoff.tsx and src/components/owner/action-history.tsx
- [ ] T108 [P] [US5] Build the collapsible exact-six-tool inspector with state-effect, confirmation, outcome, reason, and time fields in src/components/buyer/tool-inspector.tsx
- [ ] T109 [US5] Connect every WebMCP adapter to sanitized invocation persistence and keep raw arguments, tokens, contacts, and exception internals out of src/webmcp/registry.ts

**Checkpoint**: User Story 5 independently provides a complete authorized seller handoff and a safe buyer-scope activity inspector.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Complete lifecycle, security, accessibility, performance, documentation, and release verification that span stories.

- [ ] T110 [P] Implement scheduled, authenticated, idempotent 30-day draft expiration, participant revocation, finalized-retention cleanup, and deletion audit coverage in src/modules/scope/application/expire-drafts.ts, src/app/api/internal/retention/route.ts, vercel.json, and tests/integration/retention.test.ts
- [ ] T111 [P] Add no-referrer, restrictive CSP, secure-cookie, CSRF/origin, cache, and no-third-party-script protections in src/middleware.ts and next.config.ts
- [ ] T112 [P] Add automated keyboard, label/error, focus, live-region, color-independent cue, contrast, and responsive hierarchy checks in tests/e2e/accessibility.spec.ts
- [ ] T113 [P] Add timed success-criteria measurements for three-minute buyer completion, sub-500 ms p95 ordinary interactions, exactly 100 alternating updates across 10 fresh scopes with at least 95 converging within two seconds, and 20 fresh-scope finalizations with at least 19 owner-visible within five seconds; document one excluded warm-up per browser/environment, monotonic-clock boundaries, exact pass counts, and the local/CI profile in tests/e2e/performance-targets.spec.ts
- [ ] T114 [P] Add prompt-like text, HTML/script, bidi, oversized Unicode, typed-boundary fuzzing, and authority-noninterference coverage in tests/security/untrusted-content.test.ts
- [ ] T115 [P] Configure CI stages for format, lint, typecheck, contracts, unit, property, integration, concurrency, E2E, WebMCP, and redaction gates in .github/workflows/validate.yml
- [ ] T116 Document architecture, local operation, migration/rollback, evaluator compatibility, threat boundaries, and retention behavior in README.md and docs/operations.md
- [ ] T117 Validate and update every command and expected result in specs/001-agent-service-cpq/quickstart.md against the implemented repository
- [ ] T118 [P] Add one uninterrupted no-agent journey covering discovery, scope creation and reload, validation, pricing, stale-quote recovery, availability, human confirmation, finalization, retry, and owner handoff in tests/e2e/complete-ordinary-journey.spec.ts
- [ ] T119 [P] Add one uninterrupted WebMCP journey plus the 20 version-controlled capability/recovery scenarios covering all six capabilities, shared-state convergence, direct page confirmation, finalization, and side-effect assertions in tests/webmcp/complete-agent-journey.spec.ts and tests/fixtures/agent-journeys.json
- [ ] T120 Conduct the pre-release study with 10 first-time buyers, 5 first-time owner-role participants, and 20 fixed agent journeys and record anonymized protocol, raw outcomes, exact pass counts, timing environment, and failures in specs/001-agent-service-cpq/usability-report.md
- [ ] T121 Run the complete pnpm validate release gate and record FR-001–FR-035, SC-001–SC-012, Constitution Principles I–V, and pre-release study evidence in specs/001-agent-service-cpq/validation-report.md

**Checkpoint**: All constitutional and quickstart release gates pass with recorded evidence.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: No dependencies; starts immediately.
- **Phase 2 — Foundational**: Depends on Phase 1 and blocks every user story.
- **Phase 3 — US1**: Depends on Phase 2 and is the MVP increment.
- **Phase 4 — US2**: Depends on the Phase 2 foundation and uses a fixture-created scope for independent testing; product integration follows US1's scope/quote APIs.
- **Phase 5 — US3**: Depends on the Phase 2 foundation and uses a fixture-created current quote for independent testing; product integration follows US1.
- **Phase 6 — US4**: Owner drafting and publication tasks depend only on Phase 2 and may proceed in parallel with buyer stories; historical quote tasks T086 and T096–T097 depend on US1 pricing and quote persistence.
- **Phase 7 — US5**: Depends on the Phase 2 foundation and uses a fixture-finalized lead for independent testing; product integration follows US3 finalization.
- **Phase 8 — Polish**: Starts after all stories selected for the release are complete; T121 follows T110–T120.

### User Story Dependency Graph

```text
Setup -> Foundation -> US1 (MVP) -> US2
                         |
                         +-------> US3 -> US5
                  US4 ---+          |
                         +----------+
                                  Polish
```

- **US1 (P1)** establishes the public catalog, durable scope, and quote APIs used by the integrated buyer journey.
- **US2 (P2)** extends US1's scope with mutation/realtime behavior but remains testable from a seeded scope fixture.
- **US3 (P3)** consumes a current US1 quote in the integrated journey but remains testable from a seeded quote fixture.
- **US4 (P4)** owner-authoring work may begin after Foundation and supplies future catalog/rule/slot configuration; its historical quote replay work follows US1, while US1's deterministic seed keeps the MVP independently runnable before the owner editor exists.
- **US5 (P5)** consumes US3 output in the integrated journey but remains testable from a finalized-lead fixture.

### Within Each User Story

- Write and run the story's tests first; confirm they fail for the intended missing behavior.
- Implement pure domain rules before repositories and application use cases.
- Implement repositories before use cases that require persistence transactions.
- Implement use cases before HTTP, UI, and WebMCP adapters.
- Complete the independent test at the checkpoint before moving to the next priority.

### Parallel Opportunities

- T002–T008 can proceed in parallel after T001 establishes package scripts and dependencies.
- T011–T015, T018, and T020–T027 operate in separate foundational files; T010 follows T009, T016 follows the schema definitions, and T028–T030 follow their corresponding implementation.
- Each story's initial test tasks are parallelizable because they target separate test files and risk levels.
- US1 domain/repository tasks T037–T042 can be divided by module before their dependent use cases.
- US2 subscription UI work can proceed alongside its domain mutation work after the expected review model is agreed.
- US3 availability, final-summary, persistence, UI, and WebMCP files allow parallel ownership before integration in T077–T084.
- US4 can proceed alongside US2/US3 after Foundation; US5 fixture-based query and inspector work can start before integrated finalization is complete.
- Cross-cutting tasks T110–T116 and release-journey test tasks T118–T119 use distinct files and can proceed in parallel after affected story contracts stabilize; T120 records the fixed pre-release cohorts and T121 is the final gate.

---

## Parallel Examples

### User Story 1

```text
Task T037: Catalog fit domain in src/modules/catalog/domain/
Task T038: Scope normalization/validation in src/modules/scope/domain/
Task T039: Deterministic pricing evaluator in src/modules/pricing/domain/
Task T040: Catalog repository in src/db/repositories/catalog-repository.ts
Task T041: Scope repository in src/db/repositories/scope-repository.ts
Task T042: Quote repository in src/db/repositories/quote-repository.ts
```

### User Story 2

```text
Task T054: Revision and provenance unit tests in tests/unit/scope/mutation.test.ts
Task T055: Collaboration integration tests in tests/integration/scope-collaboration.test.ts
Task T056: Two-client browser tests in tests/e2e/scope-collaboration.spec.ts
Task T057: Agent collaboration tests in tests/webmcp/update-scope.spec.ts
```

### User Story 3

```text
Task T071: Availability domain in src/modules/availability/domain/bookable-slots.ts
Task T072: Availability repository in src/db/repositories/availability-repository.ts
Task T074: Final-summary domain in src/modules/finalization/domain/final-summary.ts
Task T076: Finalization repository in src/db/repositories/finalization-repository.ts
Task T081: Buyer availability UI in src/components/buyer/availability-picker.tsx
Task T083: Availability/finalization WebMCP adapters in src/webmcp/adapters/
```

### User Story 4

```text
Task T085: Configuration unit tests in tests/unit/catalog/configuration.test.ts
Task T086: Publication/history integration tests in tests/integration/owner-configuration.test.ts
Task T087: Owner configuration E2E in tests/e2e/owner-configuration.spec.ts
Task T090: Availability management in src/modules/availability/application/manage-availability.ts
```

### User Story 5

```text
Task T098: Lead projection integration tests in tests/integration/lead-review.test.ts
Task T099: Inspector contract tests in tests/contract/inspector.contract.test.ts
Task T100: Owner handoff E2E in tests/e2e/owner-lead-review.spec.ts
Task T101: Boundary redaction scans in tests/security/redaction.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and run US1 unit, property, integration, contract, ordinary-browser, and WebMCP checks.
5. Demo discovery, durable scoping, incomplete/conflict guidance, and deterministic pricing with the three seeded services.

### Incremental Delivery

1. Deliver Setup + Foundation as the secure, testable application base.
2. Deliver US1 as the discovery/scope/price MVP.
3. Add US2 for shared human-agent collaboration and visible provenance.
4. Add US3 for human-approved, atomic lead submission and booking.
5. Add US4 for reusable owner-controlled configuration and historical versioning.
6. Add US5 for seller handoff and safe agent-activity inspection.
7. Complete Polish and run the full release gate after every included story remains independently green.

### Parallel Team Strategy

After Setup and Foundation:

- One developer can advance US1's buyer path.
- A second can build US4's owner configuration against the foundational schema.
- A third can prepare fixture-driven US2/US3 tests and domain layers.
- US5 query/inspector work can begin from finalized fixtures while US3 integration finishes.

## Notes

- `[P]` means the task is safe to execute concurrently with adjacent tasks after its stated prerequisite, not that all tasks sharing a phase are automatically independent.
- User-story labels provide traceability to the specification; FR/SC ranges in each story goal define the primary requirement coverage.
- Adapter code remains thin: ordinary UI, HTTP, and WebMCP all call the same application use cases.
- No task adds payment, contract acceptance, external calendar/CRM sync, proprietary conversational AI, regulated workflows, or other out-of-scope commerce.
- Commit after each task or cohesive task group and preserve immutable migrations, contracts, evaluator versions, quotes, confirmations, and audit history.
