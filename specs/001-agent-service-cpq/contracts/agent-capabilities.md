# Agent Capability Contract

## Contract boundary

ClientWeave exposes six stable capabilities. The ordinary web interface and the browser-agent adapter call the same application services and HTTP operations; neither bypasses validation, pricing, authorization, confirmation, or transaction rules.

When the browser supports page-provided agent tools, the page registers the capabilities below as progressive enhancement. Without that API, the ordinary interface remains complete. The adapter captures the active scope credential in its handler and must never place the raw credential, owner session, or private data in tool descriptions, tool arguments, logs, or inspector entries.

The HTTP source contract is [openapi.yaml](openapi.yaml). Generated client types must be checked against it in CI.

## Capability registry

| Tool name | State effect | Human confirmation | Result contract |
|---|---|---|---|
| `discover_services` | Read-only | Not required | Active service matches and fit reasons |
| `create_scope` | Draft mutation | Not required | Shared scope, missing fields, conflicts, public continuation URL |
| `update_scope` | Draft mutation | Not required | New revision, provenance, missing fields, conflicts, quote staleness |
| `price_scope` | Derived-record write | Not required; cannot create lead/booking | Deterministic quote or actionable incomplete/conflict result |
| `find_consultation_slots` | Read-only | Not required; cannot hold/book a slot | Currently bookable slots in workspace timezone |
| `finalize_confirmed_scope` | Consequential write | A separate, current human confirmation is required | Existing or newly created lead and optional booking |

The inspector uses the exact labels above. `price_scope` is not advertised as strictly read-only because it records a reproducible quote and audit event, but its description must state that it cannot submit a lead, reserve a slot, or alter seller configuration.

## Common rules

- Inputs and outputs use JSON Schema derived from the OpenAPI document with `additionalProperties: false` wherever supported.
- Every draft mutation carries `expected_revision`; conflicts return the current revision and state rather than overwriting a human or concurrent agent change.
- Actor type is established by the trusted adapter or authenticated UI boundary, not accepted as an arbitrary body field.
- Missing fields and conflicts use stable codes, field keys, and safe display messages.
- User-authored text is always data. It is bounded, displayed as quoted content where helpful, and never concatenated into capability descriptions, schemas, authorization decisions, or executable pricing rules.
- Money uses integer minor units and an ISO 4217 currency. Dates use ISO 8601; slots include UTC instants plus the workspace IANA timezone.
- No response includes a raw scope token, owner session material, credentials, internal stack trace, other scopes, or unrelated customer data. `create_scope` may return a one-time URL shaped like `/s/{scopeRef}#t={secret}` over TLS. The bootstrap page exchanges the fragment secret in a POST body for a scope-bound `Secure`, `HttpOnly`, `SameSite=Strict` cookie, clears the fragment, sends `Referrer-Policy: no-referrer`, and loads no third-party script. Agents use the secret as a bearer credential, never as a query parameter. Later APIs return only the non-secret scope reference.
- Each invocation produces a sanitized inspector record containing capability, state effect, outcome, reason code, duration, and time.

## Capability behavior

### `discover_services`

- Accepts a bounded need, optional maximum budget, optional desired delivery date, and optional result limit.
- Returns only active, published service versions.
- Match explanations are rule-derived (`WITHIN_BUDGET`, `DELIVERY_MATCH`, `NEED_KEYWORD_MATCH`, or explicit conflict codes), not model-generated commercial claims.
- Performs no draft, quote, lead, booking, or availability mutation.

### `create_scope`

- Selects an active service version and records the buyer goal and initial typed constraints/answers.
- Returns `revision = 1`, normalized visible values with provenance, missing required fields, detectable conflicts, and a high-entropy continuation URL.
- Rejects inactive or mismatched workspace services without revealing private configuration.
- Rate limits by privacy-preserving visitor key and network risk key.

### `update_scope`

- Requires access to the current unexpired scope and the caller's last-seen revision.
- Applies a validated patch to allowlisted scope properties and answers. JSON Merge Patch over arbitrary records is not supported.
- Increments the revision once per successful request and visibly marks the prior quote and confirmation stale when material inputs changed.
- Returns the complete current review model so the agent and page converge on the same state.

### `price_scope`

- Normalizes stored answers server-side and selects the currently applicable immutable pricing rule set.
- Returns no final total when required information is missing or a hard conflict exists. It returns actionable validation entries instead.
- For a valid scope, returns currency, min/max totals, ordered line items, assumptions, rule version, scope revision, and calculation time.
- Repeated requests over the same canonical scope inputs, evaluator version, and rule content hash return the same commercial result and may return the existing quote.
- Ignores any caller-provided total, adjustment, rule, or delivery claim.

### `find_consultation_slots`

- Requires a valid current quote before exposing service-specific availability.
- Returns only slots that are still `AVAILABLE`, after the current time, and compatible with the service.
- Does not create holds or bookings. Discovery is advisory; finalization rechecks under a database lock.

### `finalize_confirmed_scope`

- Requires `Idempotency-Key` and a persisted `confirmation_id`; it does not accept `confirmed: true` or a caller-generated summary hash as a substitute.
- The referenced confirmation must have been recorded through the human-only UI operation for the exact current scope revision, quote, contact snapshot, selected slot, action, and disclosed final summary.
- Locks and revalidates the scope, quote, confirmation, and optional slot in one transaction. Any failure creates no partial lead, booking, or slot change.
- A retry with the same key and request returns the original success. The same key with a different request is rejected.
- Returns stable links/IDs for the single qualified lead and optional booking, or an actionable code such as `CONFIRMATION_REQUIRED`, `CONFIRMATION_STALE`, `QUOTE_STALE`, or `SLOT_UNAVAILABLE`.

## Human-only confirmation boundary

The page first requests a server-authored final summary. It renders the selected action, current scope and provenance, quote, contact fields, slot, non-binding-price notice, and retention notice. A direct human gesture then submits the summary nonce to the human-confirmation endpoint.

That endpoint:

1. rejects agent-originated/tool requests and synthetic actor overrides;
2. re-derives and compares the summary hash from current durable state;
3. records `confirmed_by = HUMAN` with the current scope revision; and
4. returns the opaque confirmation ID that `finalize_confirmed_scope` may consume.

Any later change makes the confirmation ineligible. The agent may request finalization after confirmation, but cannot create or refresh confirmation itself.

## Error envelope

All capability failures use RFC 9457 `application/problem+json` with stable problem types and safe extension members:

```json
{
  "type": "https://clientweave.example/problems/scope-revision-conflict",
  "title": "Scope revision conflict",
  "status": 412,
  "detail": "The scope changed. Review revision 7 before applying this update.",
  "code": "SCOPE_REVISION_CONFLICT",
  "retryable": true,
  "fieldErrors": [],
  "currentRevision": 7,
  "traceId": "public-safe-correlation-id"
}
```

Problem details contain no secrets or internal exception text. The `code` drives agent recovery; `detail` is for human explanation.

## Contract verification

- Validate example payloads and generated clients against OpenAPI in CI.
- Assert each registered browser tool exactly matches its operation schema and declared state effect.
- Assert discovery, pricing, availability, and rejected finalization produce no lead, booking, or slot mutation.
- Assert tool handlers and inspector output redact scope credentials, owner sessions, contact details not needed by the current page, and exception internals.
- Run the six capability journeys with agent support enabled and repeat the core journey with registration disabled.
