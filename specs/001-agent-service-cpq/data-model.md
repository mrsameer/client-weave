# Data Model: ClientWeave Agent-Native Service CPQ

## Modeling conventions

- Use UUIDv7 identifiers, UTC timestamps, and integer minor currency units; render dates and times in the workspace timezone.
- Every workspace-owned table carries `workspace_id`. Owner queries must include it, even when another relation already implies it.
- Store public scope bearer tokens only as hashes. A token resolves one scope and conveys no workspace membership.
- Treat published service versions, pricing rule sets, quote calculation payloads, confirmation summaries, and audit events as immutable snapshots. Corrections create new records; they do not rewrite commercial history.
- Use monotonic general, pricing, and finalization revisions on `ScopeSession`. Revisions derive quote/confirmation eligibility without mutating historical records.
- User-authored text is plain bounded data. It is never evaluated as code, a pricing condition, a capability definition, or an authorization rule.
- Normalize catalog search text with Unicode NFKC and locale-independent lowercase, tokenize contiguous Unicode letter/number runs, count distinct overlapping need/service tokens, then order active services by eligibility, descending overlap, and ascending service slug.

## Entity relationships

```text
Workspace 1──* WorkspaceMember
Workspace 1──* ServiceOffering 1──* ServiceVersion
ServiceVersion 1──* ScopeField
ServiceVersion 1──* PricingRuleSet 1──* PricingRule
ServiceVersion 1──* ServiceConstraint

Workspace 1──* ScopeSession *──1 ServiceVersion
ScopeSession 1──* ScopeParticipant
ScopeSession 1──* ScopeAnswer *──1 ScopeField
ScopeSession 1──* ScopeAssumption
ScopeSession 1──* Quote *──1 PricingRuleSet
ScopeSession 1──* HumanConfirmation
Workspace 1──* AvailabilitySlot 1──0..1 Booking
ScopeSession 1──0..1 QualifiedLead 1──0..1 Booking
Workspace 1──* AuditEvent
ScopeSession 1──* AgentInvocation
```

## Core entities

### Workspace

| Field | Type | Rules |
|---|---|---|
| `id` | UUIDv7 | Primary key |
| `slug` | string | Unique, normalized, 3–50 characters |
| `name` | string | 1–100 characters |
| `timezone` | IANA timezone | Required; MVP seed uses one timezone |
| `default_currency` | ISO 4217 code | MVP seed is `USD` |
| `draft_retention_days` | integer | Fixed at 30 for MVP |
| `finalized_retention_days` | integer | Positive and disclosed in the buyer summary |
| `created_at`, `updated_at` | timestamp | UTC |

### WorkspaceMember

| Field | Type | Rules |
|---|---|---|
| `id`, `workspace_id` | UUIDv7 | Workspace foreign key |
| `auth_subject` | string | Unique identity-provider subject |
| `email` | string | Normalized; owner-only data |
| `role` | enum | `OWNER` only in MVP |
| `status` | enum | `ACTIVE`, `DISABLED` |
| `created_at`, `last_seen_at` | timestamp | UTC |

Only an active member of the matching workspace may change configuration or read private leads.

### ServiceOffering

Stable catalog identity. Mutable activation points to an immutable published version.

| Field | Type | Rules |
|---|---|---|
| `id`, `workspace_id` | UUIDv7 | Workspace foreign key |
| `slug` | string | Unique within workspace |
| `status` | enum | `DRAFT`, `ACTIVE`, `INACTIVE` |
| `active_version_id` | UUIDv7 nullable | Must reference a published version of this offering before activation |
| `created_at`, `updated_at` | timestamp | UTC |

The workspace may have 1–10 active offerings. Public discovery returns only `ACTIVE` offerings with a valid active version.

### ServiceVersion

Immutable published description and intake configuration used by scopes.

| Field | Type | Rules |
|---|---|---|
| `id`, `service_offering_id`, `workspace_id` | UUIDv7 | Foreign keys |
| `version` | positive integer | Unique per offering |
| `name` | string | 1–100 characters |
| `description` | string | 1–2,000 characters, treated as data |
| `currency` | ISO 4217 code | All rules in a version use this currency |
| `base_min_minor`, `base_max_minor` | integer | Non-negative; minimum ≤ maximum |
| `delivery_min_business_days`, `delivery_max_business_days` | integer | Positive; minimum ≤ maximum |
| `included_items` | array of bounded strings | At least one item |
| `available_add_ons` | bounded JSON array | Unique stable keys with buyer-visible label and description; empty when no add-ons are offered |
| `published_at` | timestamp | Set once; null while draft |

Existing scopes keep their selected service version after a new version is published.

### ScopeField

| Field | Type | Rules |
|---|---|---|
| `id`, `service_version_id` | UUIDv7 | Foreign key |
| `key` | string | Unique per service version; stable machine name |
| `label`, `help_text` | string | Bounded display copy |
| `value_type` | enum | `TEXT`, `INTEGER`, `DECIMAL`, `BOOLEAN`, `DATE`, `SINGLE_CHOICE`, `MULTI_CHOICE` |
| `required` | boolean | Drives missing-field output |
| `allowed_values` | JSON array nullable | Required for choice types only |
| `min_value`, `max_value` | decimal nullable | Numeric validation |
| `min_length`, `max_length` | integer nullable | Text/array validation |
| `price_affecting` | boolean | A change invalidates a quote when true |
| `display_order` | integer | Unique per service version |

### PricingRuleSet

| Field | Type | Rules |
|---|---|---|
| `id`, `service_version_id`, `workspace_id` | UUIDv7 | Foreign keys |
| `version` | positive integer | Unique per service offering |
| `status` | enum | `DRAFT`, `ACTIVE`, `RETIRED` |
| `calculation_schema_version` | string | Selects the deterministic evaluator version |
| `content_hash` | SHA-256 digest | Canonical rule payload hash |
| `activated_at` | timestamp nullable | Only one active set per active service version |

Activation retires the prior set for future quotes but never changes prior quote snapshots.

### PricingRule

| Field | Type | Rules |
|---|---|---|
| `id`, `pricing_rule_set_id` | UUIDv7 | Foreign key |
| `type` | enum | `BASE`, `QUANTITY`, `ADD_ON`, `CONDITIONAL` |
| `priority` | integer | Unique within a rule set; lower evaluates first |
| `source_field_key` | string nullable | Must identify a field from the same service version when used |
| `operator` | enum nullable | Whitelisted typed comparisons only |
| `comparison_value` | typed JSON nullable | Must validate against the source field type |
| `adjustment_kind` | enum | `FIXED`, `PER_UNIT`, `PERCENTAGE` |
| `min_adjustment_minor`, `max_adjustment_minor` | integer | Required for fixed/per-unit; minimum ≤ maximum |
| `percentage_basis_points` | integer nullable | Bounded; percentage rules use integer arithmetic and defined rounding |
| `label` | string | Stable line-item label |

Rules are data interpreted by a closed evaluator; arbitrary expressions and executable code are prohibited. Every percentage line-item adjustment is rounded to the nearest minor currency unit with exact halves away from zero, and totals are the sum of individually rounded line items in deterministic rule order.

### ServiceConstraint

| Field | Type | Rules |
|---|---|---|
| `id`, `service_version_id` | UUIDv7 | Foreign key |
| `type` | enum | `DELIVERY_MINIMUM`, `INCOMPATIBLE_OPTIONS`, `FIELD_LIMIT`, `BUDGET_FLOOR` |
| `priority` | integer | Deterministic evaluation order |
| `field_keys` | string array | Keys must exist in the service version |
| `parameters` | typed JSON | Validated per constraint type |
| `message` | string | Actionable buyer-facing explanation |

### ScopeSession

| Field | Type | Rules |
|---|---|---|
| `id`, `workspace_id`, `service_version_id` | UUIDv7 | Foreign keys |
| `public_token_hash` | digest | Unique; raw high-entropy token is returned once |
| `status` | enum | `DRAFT`, `FINALIZED`, `EXPIRED`, `DELETED` |
| `revision` | positive integer | Incremented on every material mutation; used for collaboration conflict detection |
| `pricing_revision` | positive integer | Incremented when normalized price-affecting state changes; never decremented on edit/revert |
| `finalization_revision` | positive integer | Incremented when anything in the final summary changes |
| `goal` | string | 1–2,000 characters, treated as data |
| `goal_source_actor_type`, `goal_source_actor_id`, `goal_updated_at` | enum/string/timestamp | Server-derived latest source and time for the current goal |
| `budget_max_minor` | integer nullable | Non-negative |
| `budget_source_actor_type`, `budget_source_actor_id`, `budget_updated_at` | enum/string/timestamp | Server-derived latest source and time, including the current null state |
| `target_delivery_date` | date nullable | Interpreted in workspace timezone |
| `delivery_source_actor_type`, `delivery_source_actor_id`, `delivery_updated_at` | enum/string/timestamp | Server-derived latest source and time, including the current null state |
| `current_quote_id` | UUIDv7 nullable | Convenience pointer; eligibility is still recomputed from revisions and current rule pointers |
| `expires_at` | timestamp | Draft creation + 30 days; never extended beyond policy silently |
| `finalized_at`, `created_at`, `updated_at` | timestamp | UTC |

### ScopeParticipant

Authorizes an anonymous Supabase Auth session to the one scope established through capability exchange and to that scope's private realtime topic.

| Field | Type | Rules |
|---|---|---|
| `scope_session_id`, `workspace_id` | UUIDv7 | Workspace-aware foreign keys |
| `auth_subject` | UUID/string | Anonymous authenticated subject; unique with scope ID |
| `role` | enum | `BUYER_PARTICIPANT` in MVP |
| `created_at`, `expires_at`, `revoked_at` | timestamp | Cannot outlive the scope |

A participant ID alone does not grant owner access or access to any other scope. Capability exchange creates the relationship after resolving the secret hash; subsequent scope reads resolve through the current participant relationship.

### ScopeAnswer

| Field | Type | Rules |
|---|---|---|
| `id`, `scope_session_id`, `scope_field_id` | UUIDv7 | Unique field per scope |
| `value` | typed JSON | Validates against the selected version's field definition |
| `normalized_value` | typed JSON | Canonical representation used for pricing |
| `source_actor_type` | enum | `HUMAN`, `AGENT`, `IMPORTED`, `SYSTEM` |
| `source_actor_id` | string nullable | Pseudonymous identifier; never a secret |
| `updated_at` | timestamp | UTC |

An update overwrites the current answer but records the prior and new value in an append-only audit event.

### ScopeAssumption

| Field | Type | Rules |
|---|---|---|
| `id`, `scope_session_id` | UUIDv7 | Scope foreign key |
| `value` | string | 1–500 characters; unique after normalization within the scope |
| `source_actor_type` | enum | `HUMAN`, `AGENT`, `IMPORTED`, `SYSTEM` |
| `source_actor_id` | string nullable | Pseudonymous identifier; never a secret |
| `display_order` | integer | Unique within the scope |
| `updated_at` | timestamp | UTC |

Assumption list replacement preserves unchanged assumption identities and provenance, removes omitted items, and assigns the trusted current actor and time only to new or changed entries. Each mutation records the before/after list in the audit event.

### Quote

Immutable calculation result for one exact scope revision and rule set.

| Field | Type | Rules |
|---|---|---|
| `id`, `scope_session_id`, `pricing_rule_set_id` | UUIDv7 | Foreign keys |
| `scope_revision` | integer | Revision priced |
| `pricing_revision` | integer | Price-affecting revision priced |
| `input_snapshot` | canonical JSON | Material normalized values only |
| `input_hash` | SHA-256 digest | Hash of canonical snapshot + rule content hash + evaluator version |
| `currency` | ISO 4217 code | Matches service version |
| `total_min_minor`, `total_max_minor` | integer | Non-negative; minimum ≤ maximum |
| `line_items` | canonical JSON array | Ordered, labeled min/max adjustments and rule IDs |
| `assumptions`, `missing_fields`, `conflicts` | canonical JSON arrays | Deterministically ordered |
| `calculated_at` | timestamp | Informational; excluded from deterministic result hash |

A quote is eligible for finalization only when it has no missing fields or conflicts, its pricing revision equals the scope's current pricing revision, and its rule set is still the offering's active set. The API derives explicit stale reasons such as `SCOPE_PRICING_CHANGED` and `RULE_SET_SUPERSEDED`; it never mutates the historical quote. Repeated requests for the same `input_hash` return the same commercial result.

### AvailabilitySlot

| Field | Type | Rules |
|---|---|---|
| `id`, `workspace_id` | UUIDv7 | Foreign keys |
| `starts_at`, `ends_at` | timestamp | UTC; start < end; rendered in workspace timezone |
| `availability_state` | enum | `AVAILABLE`, `BLOCKED`, `HELD`; effective `BOOKED` is derived from an active booking |
| `hold_expires_at` | timestamp nullable | Required only for a temporary hold |
| `created_at`, `updated_at` | timestamp | UTC |

Overlapping available slots are rejected for the MVP. Finalization locks the selected row, verifies stored state is `AVAILABLE` or a valid caller-owned `HELD`, and inserts the unique booking in the same transaction. `BOOKED` remains an effective state derived from the active booking and is never written to `availability_state`.

### HumanConfirmation

| Field | Type | Rules |
|---|---|---|
| `id`, `scope_session_id`, `quote_id` | UUIDv7 | Foreign keys |
| `scope_revision`, `finalization_revision` | integer | Both must equal the current revisions at confirmation |
| `selected_slot_id` | UUIDv7 nullable | Included when booking is requested |
| `contact_snapshot` | canonical JSON | Only fields needed for the selected next step |
| `action` | enum | `SUBMIT_LEAD`, `SUBMIT_LEAD_AND_BOOK` |
| `summary_hash` | digest | Server digest of the complete attributed scope and service-constraint snapshot, current eligible quote totals/line items, slot, contact, action, notices, and expiry |
| `confirmed_by` | enum | `HUMAN` only |
| `confirmed_at`, `invalidated_at` | timestamp | Current only while not invalidated |

An agent cannot create a valid confirmation. Any material input change makes the saved hash ineligible, even if a client replays it.

### QualifiedLead

| Field | Type | Rules |
|---|---|---|
| `id`, `workspace_id`, `scope_session_id`, `quote_id`, `confirmation_id` | UUIDv7 | Unique `scope_session_id`; immutable handoff links |
| `contact_snapshot` | canonical JSON | Minimal confirmed contact data |
| `status` | enum | `NEW`, `REVIEWED`, `ARCHIVED` |
| `created_at` | timestamp | UTC |

### Booking

| Field | Type | Rules |
|---|---|---|
| `id`, `workspace_id`, `lead_id`, `scope_session_id`, `slot_id` | UUIDv7 | `slot_id` and `scope_session_id` are each unique |
| `contact_snapshot` | canonical JSON | Matches confirmed summary |
| `status` | enum | `CONFIRMED`, `CANCELLED` |
| `created_at`, `cancelled_at` | timestamp | UTC |

### IdempotencyRecord

| Field | Type | Rules |
|---|---|---|
| `workspace_id`, `scope_session_id`, `key` | composite key | Unique for finalization |
| `request_hash` | digest | Same key with a different request is rejected |
| `status` | enum | `IN_PROGRESS`, `SUCCEEDED`, `FAILED_RETRYABLE` |
| `response_status`, `response_body` | integer/JSON nullable | Stored successful result returned to retries |
| `created_at`, `expires_at` | timestamp | Retained at least through client retry window |

The idempotency record, lead, booking, slot transition, scope finalization, and audit events commit atomically.

### AuditEvent

| Field | Type | Rules |
|---|---|---|
| `id`, `workspace_id`, `scope_session_id` | UUIDv7 | Scope may be null for configuration events |
| `sequence` | integer | Monotonic within a scope; unique with scope ID |
| `actor_type` | enum | `HUMAN`, `AGENT`, `IMPORTED`, `SYSTEM` |
| `actor_id` | string nullable | Pseudonymous/member ID |
| `action_type` | enum/string | Closed catalog of significant actions |
| `outcome` | enum | `SUCCEEDED`, `REJECTED`, `FAILED` |
| `details` | sanitized JSON | IDs, changed field names, reason codes; no bearer tokens or credentials |
| `occurred_at` | timestamp | UTC |

Audit events are append-only for application roles.

### AgentInvocation

Sanitized operational record used by the public scope's tool inspector.

| Field | Type | Rules |
|---|---|---|
| `id`, `scope_session_id` | UUIDv7 | Foreign keys |
| `capability` | enum | One of the six declared capabilities |
| `state_effect` | enum | `READ_ONLY`, `DRAFT_MUTATION`, `DERIVED_RECORD_WRITE`, `CONSEQUENTIAL_WRITE` |
| `outcome`, `reason_code` | enum/string | No raw secret-bearing errors |
| `duration_ms`, `occurred_at` | integer/timestamp | Bounded retention |

Public inspection is restricted to invocations for the current scope. Owner inspection may aggregate within its workspace.

## State transitions

### Scope session

```text
DRAFT ──successful confirmed finalization──> FINALIZED
  ├────retention deadline──────────────────> EXPIRED
  └────authorized deletion─────────────────> DELETED
```

Only `DRAFT` accepts answer mutations. A finalized scope is a historical snapshot; corrections start a new draft.

### Quote eligibility

```text
VALID CURRENT ──pricing revision mismatch───────> STALE
VALID CURRENT ──active rule pointer changes────> STALE but still reproducible
INCOMPLETE/CONFLICTED ──scope correction + reprice──> VALID CURRENT
```

Rule publication does not rewrite or silently invalidate historical totals. A new price request uses the offering's current rule set and replaces the scope's current quote pointer.

### Confirmation

```text
PRESENTED ──human confirms exact summary──> CURRENT
CURRENT ──scope/quote/slot/contact/action change──> INVALIDATED
CURRENT ──successful finalization──────────> CONSUMED
```

### Slot

```text
AVAILABLE ──owner action──> BLOCKED
AVAILABLE ──optional hold──> HELD ──expiry──> AVAILABLE
AVAILABLE or valid HELD ──atomic booking insert──> effectively BOOKED
```

The booking uniqueness constraint and conditional slot update are the final double-booking backstop.

## Transaction and integrity boundaries

- **Scope mutation**: lock scope, validate the expected revision, update built-in attributed values, diff ordered assumptions while preserving unchanged provenance, upsert attributed answers, increment the applicable revisions, append the audit event, and commit. A private database Broadcast trigger emits only the scope ID, revision, and event type after the committed change; clients refetch the authorized snapshot.
- **Quote calculation**: read one consistent snapshot of scope, fields, constraints, and active rule set; normalize and calculate in the domain layer; persist the immutable result and set `current_quote_id` only if the scope revision is unchanged.
- **Human confirmation**: recompute the server summary hash from current stored data; persist only for a human-originated request and current revision.
- **Finalization**: claim the idempotency key; lock scope, confirmation, quote, and slot in a fixed order; revalidate all invariants; conditionally claim the slot; insert lead and optional booking; finalize scope; append events; save the response; commit. Any failed invariant rolls back the whole transaction.
- **Configuration publication**: validate the complete service graph, create immutable versions, atomically switch active pointers, and append an owner audit event.

## Required indexes and constraints

- Unique `(workspace_id, service_offering.slug)`, `(service_offering_id, service_version.version)`, and `(service_version_id, scope_field.key)`.
- Unique `(service_offering_id, pricing_rule_set.version)` and `(pricing_rule_set_id, pricing_rule.priority)`.
- Unique `ScopeSession.public_token_hash`; index draft `expires_at` for retention cleanup.
- Unique `(scope_session_id, ScopeParticipant.auth_subject)`; index participant expiry/revocation for authorization cleanup.
- Unique `(scope_session_id, scope_field_id)` for current answers.
- Unique `(scope_session_id, ScopeAssumption.display_order)` and normalized assumption value within a scope.
- Unique `(scope_session_id, pricing_revision, pricing_rule_set_id, quote.input_hash)` to deduplicate identical calculations.
- Unique `QualifiedLead.scope_session_id`, `Booking.slot_id`, and `Booking.scope_session_id`.
- Unique `(workspace_id, scope_session_id, IdempotencyRecord.key)`.
- Unique `(scope_session_id, AuditEvent.sequence)`; indexes on workspace/time for owner history.
- Database checks for valid monetary ranges, delivery ranges, time intervals, and enum-compatible nullable fields.
