# Research: ClientWeave Agent-Native Service CPQ

## Decision 1: Build a TypeScript modular monolith

**Decision**: Use a single Next.js 16 App Router application on Node.js 24 LTS with React 19 and TypeScript 6. Organize it by catalog, scope, pricing, availability, finalization, leads, and audit modules. Each module separates pure domain rules, application use cases, and persistence adapters. Deploy Node functions, not the Edge runtime.

**Rationale**: One deployable is the smallest architecture that can serve the public buyer UI, owner UI, versioned HTTP API, and browser-agent adapter while guaranteeing that every entry point calls the same rules. Node runtime support is needed for PostgreSQL transactions, mature crypto, and consistent observability. Node 24 is the production LTS line as of the planning date, while Node 26 remains Current. Sources: [Node.js releases](https://nodejs.org/en/about/previous-releases), [Vercel Node runtime](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Next.js App Router](https://nextjs.org/docs/app).

**Alternatives considered**:

- Separate frontend and API services: rejected for the MVP because it adds deployments and duplicate boundaries without improving domain correctness.
- Edge-only handlers: rejected because the finalization transaction and database-driver behavior matter more than edge latency.
- Microservices: rejected because no domain needs independent scaling or ownership yet, and cross-service transactions would weaken finalization atomicity.

## Decision 2: Make Zod the executable contract source and WebMCP a progressive adapter

**Decision**: Treat strict Zod 4 schemas under `src/contracts/schemas/` as the authoritative executable contract; generate and check in JSON Schema, OpenAPI 3.1, and client artifacts from them; and expose versioned `/api/v1` operations. CI regenerates every artifact and fails on drift. Register exactly the six required page tools with `document.modelContext.registerTool()` when WebMCP is available. Both the ordinary UI and WebMCP handlers call the same application use cases. Do not expose the human-confirmation endpoint as a tool. A future remote MCP server may wrap the HTTP API but is not part of this MVP.

**Rationale**: Zod gives server handlers and adapters one executable validation source, while generated OpenAPI remains the browser-independent, testable public artifact. Generating JSON Schema, OpenAPI, and clients in one direction avoids a second independently maintained schema system. WebMCP best matches the specification's same-live-page experience but remains proposed/experimental and Chrome-specific, so it cannot be the only way to complete the journey. Sources: [OpenAPI 3.1 specification](https://spec.openapis.org/oas/v3.1.0), [Zod JSON Schema](https://zod.dev/json-schema), [Chrome WebMCP](https://developer.chrome.com/docs/ai/webmcp/), [WebMCP proposal](https://github.com/webmachinelearning/webmcp), [Puppeteer WebMCP guide](https://pptr.dev/guides/webmcp/).

**Alternatives considered**:

- WebMCP only: rejected because ordinary users and non-supporting browsers must retain the full workflow.
- A separate remote MCP implementation: deferred because browser-bound scope access and visible human approval are central; duplicating the adapter now creates unnecessary drift risk.
- Hand-maintained independent schemas per UI/API/tool: rejected because contract drift would undermine the shared-rules guarantee.

## Decision 3: Use PostgreSQL as the commercial source of truth

**Decision**: Use Supabase-managed PostgreSQL 17 with Drizzle ORM, checked-in SQL migrations, and `postgres.js`. Store UUIDv7 keys, integer minor currency units, UTC instants, and the workspace's IANA timezone. Keep the Data API inaccessible for domain writes; all application writes pass through server-side use cases and transactions.

**Rationale**: Versioned relational rules, immutable quote history, tenant-aware authorization, unique lead/booking invariants, and row-level contention are natural PostgreSQL workloads. Supabase's supported platform target is PostgreSQL 17 even though a newer upstream major exists, so local and hosted environments should match. Drizzle retains direct access to PostgreSQL constraints and locks. PostgreSQL exact `numeric` is appropriate for intermediate fixed-precision values, while published monetary totals remain integer minor units. Sources: [Supabase PostgreSQL upgrades](https://supabase.com/docs/guides/platform/upgrading), [PostgreSQL numeric types](https://www.postgresql.org/docs/current/datatype-numeric.html), [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html).

**Alternatives considered**:

- Firestore: rejected because relational versioning, uniqueness, and high-contention booking transactions are the core risks.
- Prisma: viable, but Drizzle is preferred for explicit SQL migrations and low-friction access to PostgreSQL locking and partial/exclusion indexes.
- Store rules and quotes as unstructured documents: rejected because referential integrity and auditable evolution would be weaker.

## Decision 4: Use revisioned shared state and private realtime invalidations

**Decision**: PostgreSQL remains authoritative. Each scope carries general, pricing, and finalization revisions, and every material current value (goal, budget, target delivery, each assumption, and every answer) persists server-derived actor/time provenance. Mutations of an existing draft require an expected general revision and return the full attributed review model. After commit, the app publishes a minimal `{scopeId, revision, eventType}` message to a Supabase private Broadcast topic. TanStack Query invalidates and refetches the durable snapshot. Messages never contain secrets or full contact data.

**Rationale**: Bounded typed form fields need optimistic concurrency and refetch, not a CRDT. Private Broadcast supports authenticated topics across multiple stateless application instances and meets the two-second collaboration target while keeping database state authoritative. Sources: [Supabase Broadcast database changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes), [Supabase Realtime authorization](https://supabase.com/docs/guides/realtime/authorization), [HTTP conditional requests](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match).

**Alternatives considered**:

- Yjs/CRDT: rejected because simultaneous free-form document editing is not required; revisioned fields are simpler to explain and audit.
- Polling only: acceptable fallback, but private invalidations reduce unnecessary requests and give clearer latency behavior.
- Realtime payloads as state: rejected because dropped, delayed, or duplicated messages must not become a consistency problem.

## Decision 5: Bind anonymous public access to one scope capability

**Decision**: Create a non-secret scope reference plus a 32-byte CSPRNG secret. Store only a keyed fingerprint/hash. Put the secret in the URL fragment (`/s/{scopeRef}#t={secret}`), exchange it through a first-party POST for a scope-bound `Secure`, `HttpOnly`, `SameSite=Strict`, `__Host-` session cookie, then clear the fragment. Use `Referrer-Policy: no-referrer`, a restrictive CSP, and no third-party scripts on the bootstrap page. Agents use a bearer credential in the authorization header. A Supabase anonymous Auth identity becomes a participant in only that scope and authorizes its private realtime topic.

**Rationale**: URL fragments are not sent in routine HTTP requests, and bearer tokens in query strings are prone to logging. An unpredictable identifier alone is not authorization, so every lookup must resolve through the capability/session and scope-participant relationship. Supabase anonymous identities provide RLS-compatible participants without collecting name or email before finalization. Sources: [URI fragments](https://www.rfc-editor.org/rfc/rfc3986.html), [OAuth bearer token usage](https://www.rfc-editor.org/rfc/rfc6750.html), [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [Supabase anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous), [OWASP IDOR prevention](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html).

**Alternatives considered**:

- Token in query/path: rejected because infrastructure and analytics commonly record it.
- Buyer accounts: rejected because the specification explicitly keeps the pre-finalization journey anonymous and low-friction.
- Public UUID alone: rejected because object-level authorization is still required even with unguessable identifiers.

## Decision 6: Make pricing pure, ordered, version-pinned, and reproducible

**Decision**: Implement a server-only pure TypeScript evaluator:

```text
(canonical normalized scope, immutable pricing rule set, evaluator version)
  -> deterministic quote result
```

Use integer minor units for money and integer basis points for percentages. Round every percentage line-item adjustment to the nearest minor currency unit with exact halves rounded away from zero, then calculate the published total by summing the individually rounded ordered line items. Apply rules by owner priority followed by stable rule key. Canonicalize consumed inputs before hashing; explicitly define null/absent behavior and encode fixed decimals as strings. Persist the rule set ID/content hash, evaluator version, normalized input snapshot/hash, ordered line items, assumptions, conflicts, and totals. Retain compatibility evaluators for the quote retention period.

**Rationale**: PostgreSQL does not guarantee row order without `ORDER BY`, floating point is inexact, and `jsonb` does not preserve the original object-key order. A version-pinned pure function plus canonical inputs supports exact replay and golden/property testing. Sources: [PostgreSQL ordering](https://www.postgresql.org/docs/current/queries-order.html), [PostgreSQL numeric types](https://www.postgresql.org/docs/current/datatype-numeric.html), [PostgreSQL JSON types](https://www.postgresql.org/docs/current/datatype-json.html), [RFC 8785 JSON canonicalization](https://www.rfc-editor.org/info/rfc8785/).

**Alternatives considered**:

- JavaScript floating-point totals: rejected because rounding and exact reproduction would be fragile.
- Arbitrary expressions or natural-language pricing rules: rejected because authored text must not become executable authority.
- Copy only the displayed total into a quote: rejected because historical calculations would not be independently auditable.

## Decision 7: Derive staleness from immutable revisions

**Decision**: Published pricing rule sets and quote rows are append-only. A quote is current only if it is valid, its pricing revision equals the scope's current pricing revision, and its rule set remains the offering's active set. Editing and reverting a value increments the revision again and does not resurrect an older quote. Return explicit stale reason codes rather than updating a mutable quote status.

**Rationale**: Derived eligibility avoids missed fan-out updates and preserves quote immutability. Separate revisions let non-price edits avoid unnecessary re-pricing while still invalidating a final summary when appropriate.

**Alternatives considered**:

- Mutable `quote.status`: rejected because every relevant mutation and rule publication would need a perfectly reliable quote update.
- Hash-only staleness: rejected because edit-then-revert could silently revive old commercial approval.

## Decision 8: Treat confirmation as a server-authored, human-only receipt

**Decision**: The server creates the exact final-summary response and canonical hash over scope/finalization revision, the complete attributed scope snapshot (including service requirements and constraints), current eligible quote identity/fingerprint, rule version, total, and line items, selected slot/version, normalized minimal contact data, action, notices, and expiry. The ordinary UI renders this response without reconstructing omitted commercial fields and records a short-lived, single-use human confirmation. This confirmation operation is not an agent tool. `finalize_confirmed_scope` accepts only an opaque confirmation ID and idempotency key; it re-derives every invariant.

**Rationale**: A caller-supplied boolean or hash does not prove that the current summary was displayed and approved. Binding confirmation to significant transaction data and invalidating it after changes preserves human authority. For anonymous buyers this establishes explicit browser interaction, not cryptographic proof of a distinct human identity; stronger identity assurance is outside MVP scope. Source: [OWASP transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html).

**Alternatives considered**:

- `confirmed: true` on finalization: rejected because an agent could assert it.
- Agent-visible confirmation tool: rejected because it violates the constitution's human authority boundary.
- Require buyer identity before scoping: rejected because the spec defers contact collection until finalization.

## Decision 9: Enforce idempotency and slot exclusivity in one short transaction

**Decision**: Finalization claims an idempotency ledger record, then locks the scope, offering, and optional slot in a fixed order. It rechecks expiration, active rule pointer, quote eligibility, confirmation hash/revision, minimal contact, and slot availability. It inserts one lead and optional booking under unique `scope_id`/`slot_id` constraints, appends audit records, stores the idempotent response, and commits atomically. Same key/same request returns the stored result; same key/different request returns `409`. No network call occurs inside the transaction.

Use `READ COMMITTED` with explicit row locks and hard unique constraints. Retry recognized transaction/deadlock failures at the use-case boundary. Fifty-way contention tests use independent PostgreSQL connections.

**Rationale**: Row locks linearize scope updates, rule publication, slot withdrawal, and finalization. Unique constraints remain the last defense even when contenders use different idempotency keys. PostgreSQL `ON CONFLICT` provides atomic arbitration for the ledger. Sources: [PostgreSQL row locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS), [PostgreSQL deadlocks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-DEADLOCKS), [PostgreSQL `INSERT ... ON CONFLICT`](https://www.postgresql.org/docs/current/sql-insert.html), [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html).

**Alternatives considered**:

- Application mutex/advisory lock only: rejected because a real slot row and unique constraint are simpler and survive multiple instances.
- Serializable isolation for everything: viable, but creates broader retry burden without replacing required business uniqueness constraints.
- Reserve the slot during availability discovery: rejected because read-only discovery must not change availability.

## Decision 10: Use bounded schemas, layered authorization, and durable audit records

**Decision**: Reject unknown properties and enforce required fields, enums, maximum text/array sizes, currency/date formats, and typed rule operands. Derive workspace, actor, provenance, totals, and rule versions server-side. Owner auth uses Supabase Auth and a matching active `WorkspaceMember`; every owner use case scopes queries by workspace. Require origin/CSRF defenses on browser mutations. Rate limit at Vercel WAF by route/IP and in PostgreSQL by scope/operation, with stricter limits for creation, confirmation, and finalization. Return RFC 9457 problem details. Keep append-only business audit events separate from redacted structured application logs.

**Rationale**: Prompt-like prose cannot alter capabilities when all authority lives in closed schemas and server rules. Object-level authorization, resource bounds, and redaction are required at every adapter, not only the page. Sources: [RFC 9457 problem details](https://www.rfc-editor.org/rfc/rfc9457.html), [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), [NIST agent hijacking research](https://www.nist.gov/news-events/news/2025/01/technical-blog-strengthening-ai-agent-hijacking-evaluations), [Vercel WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).

**Alternatives considered**:

- IP-only limiting: rejected because shared networks and reconnects make it both unfair and bypassable; combine it with scope/token fingerprints.
- Store raw requests in the audit trail: rejected because it duplicates PII and secrets and enlarges breach impact.
- Sanitize prose and then treat it as trusted instruction: rejected because sanitization does not turn content into authority.

## Decision 11: Verify constitutional invariants at multiple levels

**Decision**: Use Vitest for unit/golden tests, `fast-check` for deterministic pricing properties, real PostgreSQL integration and concurrency tests, Playwright for the ordinary cross-browser journey, and a small Puppeteer WebMCP suite. CI runs format/lint/type checks, unit/property/contract tests, migrations and integrations, the 50-contender booking test, ordinary E2E, WebMCP smoke tests, and response/log secret scans.

**Rationale**: Pure calculations belong at unit/property level; persistence, authorization, versioning, rollback, and contention claims require a real database; complete human and agent journeys require browser tests. Puppeteer exposes specific WebMCP inspection/invocation support while Playwright remains the broader UI runner. Source: [Puppeteer WebMCP guide](https://pptr.dev/guides/webmcp).

**Alternatives considered**:

- Mocked database concurrency tests: rejected because they cannot prove PostgreSQL lock and uniqueness behavior.
- Browser-only pricing verification: rejected because it is slow and gives poor coverage of rule combinations and rounding boundaries.

## Decision 12: Deploy on Vercel and Supabase with pinned environments

**Decision**: Deploy Next.js to Vercel Pro on Node 24.x and Supabase Pro in the same region on PostgreSQL 17. Use pooled runtime connections with a direct connection for migrations. Use data-less preview branches seeded from version-controlled fixtures, daily backups, and PITR before real customer data. Pin exact dependencies in `pnpm-lock.yaml`; the initial compatibility bands are Next.js 16.x, React 19.x, TypeScript 6.x, Zod 4.x, Drizzle 0.45.x, Supabase JS 2.x, Vitest 4.x, and Playwright 1.x.

**Rationale**: The managed pairing minimizes operational work while supporting database transactions, private realtime, owner/anonymous auth, preview environments, and Node execution. TypeScript 7 is intentionally deferred until its compiler API and lint ecosystem are ready. Sources: [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase branching](https://supabase.com/docs/guides/deployment/branching), [TypeScript 7 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).

**Alternatives considered**:

- Fly.io/Render plus standalone PostgreSQL/Auth/WebSockets: viable but adds operational ownership without improving MVP commercial correctness.
- Develop on PostgreSQL 18 while hosting on 17: rejected because environment differences add avoidable migration and SQL risk.

## Decision 13: Use transparent deterministic service matching

**Decision**: Normalize the buyer need and each active service's name, description, and included items with Unicode NFKC and locale-independent lowercase, tokenize contiguous Unicode letter/number runs, and score the count of distinct overlapping tokens. Return active services ordered by eligibility first, descending overlap score second, and service slug ascending as the stable tie-breaker. Budget and approximate delivery timing contribute explicit eligibility, fit, and conflict codes but do not silently remove an active service from results.

**Rationale**: A small seller catalog needs reproducible, inspectable matching rather than an opaque model ranking. Returning ineligible active services with clear budget or timing conflicts also preserves under-budget tradeoff discovery when no offering is an exact fit.

## Decision 14: Use fixed pre-release validation cohorts

**Decision**: Validate buyer outcomes with 10 first-time participants, owner configuration with 5 first-time owner-role participants, and agent behavior with 20 fixed version-controlled journeys. Buyer SC-001, SC-002, and SC-008 thresholds require 9 of 10 successes; SC-009 requires all 5 owners to finish within 15 minutes; SC-004 requires 19 of 20 agent journeys. Any unintended consequential action independently fails SC-005 regardless of the aggregate agent score.

**Rationale**: Fixed cohort sizes turn percentage criteria into exact pass counts, make repeated pre-release evidence comparable, and prevent an aggregate score from masking a human-authority violation.

## Clarification resolution

All Technical Context unknowns are resolved by the decisions above. No constitutional exception or unresolved gate remains.
