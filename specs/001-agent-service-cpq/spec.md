# Feature Specification: ClientWeave Agent-Native Service CPQ

**Feature Branch**: `main`

**Created**: 2026-09-02

**Status**: Draft

**Input**: User description: "Build ClientWeave, an agent-native configure-price-quote workspace where a prospect and their AI agent jointly discover, scope, deterministically price, and book professional services from the same live web page."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover, Scope, and Price a Service (Priority: P1)

As a prospective client, I want my agent to find a suitable service, turn my goal and constraints into a complete draft scope, and obtain a trustworthy price range so that I can judge fit without a long email exchange or an unnecessary discovery call.

**Why this priority**: This is ClientWeave's core value: converting a vague inquiry into a priced, machine-verifiable scope using the seller's actual commercial rules.

**Independent Test**: Seed one agency with three active services and their intake and pricing rules. Ask an agent to find a website package for a stated budget and deadline, create the scope, fill its requirements, and request a quote. Verify that the visible scope and reproducible line-item quote match the configured rules.

**Acceptance Scenarios**:

1. **Given** several active services, **When** a buyer or agent supplies a goal, maximum budget, and desired delivery window, **Then** the matching services are returned with enough information to compare their fit.
2. **Given** a selected service and a buyer goal, **When** a draft scope is created, **Then** the scope shows the supplied requirements, constraints, and every required item that is still missing.
3. **Given** a complete and valid scope, **When** a quote is requested, **Then** the buyer sees a deterministic price range, line items, assumptions, rule version, and any delivery constraints.
4. **Given** an incomplete scope, **When** a quote is requested, **Then** no final price is presented and the specific missing information is returned.

---

### User Story 2 - Collaborate on One Visible Scope (Priority: P2)

As a prospective client, I want edits from me and my agent to appear in the same scope with their origins visible so that I remain aware of what the agent proposed and can directly correct any detail.

**Why this priority**: Shared, attributable state makes human-agent collaboration visible and prevents the experience from becoming an opaque form-filling exercise.

**Independent Test**: Have an agent populate a draft, let the buyer change the deadline in the ordinary interface, and then let the agent update an add-on. Verify that both views show the latest values and label each value with the actor that last set it.

**Acceptance Scenarios**:

1. **Given** an active scope, **When** the agent adds or changes an answer, **Then** the buyer sees the same value and an agent provenance label on the scope canvas.
2. **Given** an agent-created scope, **When** the buyer edits the budget or deadline, **Then** the revised constraint becomes the current value and is labeled as a human edit.
3. **Given** a human edit that invalidates the current quote, **When** the scope is reviewed again, **Then** the prior quote is visibly stale and a new quote reflects the revised scope.
4. **Given** a scope with a budget, delivery, or option conflict, **When** the agent proposes and applies a buyer-approved tradeoff, **Then** the changed requirement and recalculated quote are visible to the buyer.

---

### User Story 3 - Approve and Book the Next Step (Priority: P3)

As a prospective client, I want to review the completed scope, quote, and consultation details before any booking or lead submission occurs so that I retain control over consequential actions.

**Why this priority**: A qualified scope becomes commercially useful only when it leads to a safe next step, while explicit approval preserves buyer trust.

**Independent Test**: Starting from a valid quoted scope, retrieve available consultation slots, select one, display the final summary, record buyer approval, and book it. Verify that attempting the same action without approval fails and that the booked slot is no longer available.

**Acceptance Scenarios**:

1. **Given** a valid current quote, **When** the buyer or agent requests consultation availability, **Then** only currently bookable slots in the agency's timezone are shown.
2. **Given** a selected slot and completed scope, **When** explicit human confirmation has not been recorded, **Then** the system does not submit the lead or reserve the slot.
3. **Given** a selected available slot, valid contact details, and visible human confirmation of the final summary, **When** finalization is requested, **Then** one booking and one qualified lead are created from the confirmed scope.
4. **Given** a finalization request that is retried, **When** the original request already succeeded, **Then** the existing result is returned without creating a duplicate lead or booking.

---

### User Story 4 - Configure the Sales Surface (Priority: P4)

As a service-business owner, I want to define active offerings, intake questions, price adjustments, delivery constraints, and consultation availability so that buyers and agents receive answers based on my business rules.

**Why this priority**: Seller-controlled configuration turns the demonstration into a reusable product rather than a single hard-coded quote flow.

**Independent Test**: As the workspace owner, publish a service with required fields, all supported price-adjustment types, an incompatible-option rule, and consultation slots. Verify that the buyer experience immediately uses only the published configuration.

**Acceptance Scenarios**:

1. **Given** an authenticated workspace owner, **When** the owner creates and activates a service with intake and pricing rules, **Then** the service becomes available to buyers and agents.
2. **Given** an inactive service, **When** a buyer or agent searches the catalog, **Then** the inactive service is not offered.
3. **Given** a changed pricing rule, **When** a new quote is created, **Then** it uses the new version while previously issued quotes retain their original result and rule reference.
4. **Given** availability in the workspace's timezone, **When** the owner removes or blocks a slot, **Then** it can no longer be selected for a new booking.

---

### User Story 5 - Review Qualified Leads and Agent Activity (Priority: P5)

As a service-business owner, I want to see each finalized scope, its quote, booking, provenance, and action history so that I can prepare for the consultation and trust how the lead was produced.

**Why this priority**: The seller-side handoff completes the revenue workflow and makes the value of structured scoping observable.

**Independent Test**: Finalize a buyer scope and then open the owner lead view. Verify that it contains the buyer's requirements, constraints, contact details, quote snapshot, booking, and chronological history of human, agent, and system actions.

**Acceptance Scenarios**:

1. **Given** a finalized scope, **When** the workspace owner opens the lead view, **Then** the confirmed scope, current quote snapshot, contact details, and booking are presented together.
2. **Given** human, agent, and system changes to a scope, **When** the owner reviews its history, **Then** each significant action is shown with actor type, action type, and time.
3. **Given** activity in the buyer workspace, **When** the tool inspector is opened, **Then** it lists the agent-available actions and the recent calls without exposing private credentials or hidden data.

### Edge Cases

- A buyer's budget is below every active service or the requested delivery date is earlier than every service permits.
- A required answer is missing, has the wrong type, exceeds an allowed quantity, or names an unsupported option.
- Selected add-ons are mutually incompatible or a conditional price rule conflicts with a delivery constraint.
- The buyer changes a priced field after a quote is produced; the old quote must be marked stale rather than silently presented as current.
- Two buyers attempt to reserve the same consultation slot at nearly the same time; only one can receive a confirmed booking.
- A booking request is repeated because of a retry, refresh, or agent uncertainty; it must not create duplicates.
- A consultation slot expires or is withdrawn after discovery but before confirmation; finalization must fail safely and return fresh availability.
- A public scope link is invalid, expired, or belongs to a different workspace; no scope or workspace-private information is revealed.
- User-authored service descriptions or scope answers contain instructions aimed at manipulating an agent; this content remains data and cannot redefine available actions or permissions.
- An agent attempts to submit a lead or book a slot without an explicit, current human confirmation.
- An old quote is viewed after the owner changes pricing; the historical quote remains reproducible and is clearly distinguished from a new quote.
- Agent capabilities are unavailable in the visitor's browser; the complete discovery, scoping, pricing, and booking workflow remains usable through the ordinary interface.

## Requirements *(mandatory)*

### Scope Boundaries

The MVP includes one service-business workspace, one owner role, three seeded service offerings, shared buyer scope sessions, deterministic quote calculation, native consultation availability, finalized lead review, action history, and an inspector that demonstrates the agent-facing sales capabilities. The owner may configure between one and ten active services.

The MVP excludes payment collection, contract acceptance, binding proposals, proprietary conversational AI, external calendar or CRM synchronization, custom domains, multi-brand operation, advanced team permissions, automated proposal documents, and regulated medical, legal, lending, insurance, or financial-advice services.

### Functional Requirements

- **FR-001**: The product MUST provide a complete ordinary web experience for discovering, scoping, pricing, and booking services without requiring an agent.
- **FR-002**: The product MUST expose six distinct agent-available capabilities: discover services, create a scope, update a scope, price a scope, find consultation slots, and finalize a confirmed scope.
- **FR-003**: Each agent-available capability MUST clearly identify whether it only reads information or can change business state; discovery, pricing, and availability checks MUST NOT create leads or bookings.
- **FR-004**: Service discovery MUST return only active offerings and MUST support matching by buyer need, budget, and approximate delivery timing.
- **FR-005**: A service offering MUST state its description, base price, currency, expected delivery range, included items, available add-ons, intake fields, and relevant constraints.
- **FR-006**: A buyer or agent MUST be able to create a draft scope containing a goal, selected service, requirements, budget, target delivery timing, and assumptions.
- **FR-007**: Creating or updating a scope MUST return all required fields that are still missing and all currently detectable conflicts.
- **FR-008**: Human and agent interactions MUST read and modify the same durable scope session rather than separate copies of the buyer's data.
- **FR-009**: Every scope answer MUST identify whether its latest value came from a human, agent, imported source, or system rule, and this provenance MUST be visible on the scope canvas.
- **FR-010**: A scope MUST remain available after a page reload until it is finalized, expires, or is deleted under the retention policy.
- **FR-011**: The product MUST calculate prices exclusively from the owner's active rules and normalized scope values; an agent-supplied total MUST never replace the calculated result.
- **FR-012**: MVP pricing MUST support base price, quantity adjustments, optional add-ons, and conditional adjustments, applied in an owner-defined priority order.
- **FR-013**: A quote MUST include currency, minimum and maximum total, itemized adjustments, assumptions, missing information, constraint conflicts, calculation time, and the pricing-rule version used.
- **FR-014**: Repeating a quote request with the same normalized scope and the same pricing-rule version MUST produce the same totals and line items.
- **FR-015**: A quote MUST become visibly stale when any price-affecting scope value or relevant pricing rule changes, and a stale quote MUST NOT be eligible for finalization.
- **FR-016**: Issued quotes MUST retain enough of their original scope and rule context for an owner to reproduce and audit the displayed result after rules change.
- **FR-017**: The product MUST return actionable validation details when a scope is incomplete, outside service limits, incompatible with its selected options, over budget, or infeasible for the requested timing.
- **FR-018**: A buyer or agent MUST be able to view currently available consultation slots in the workspace's stated timezone.
- **FR-019**: Before lead submission or booking, the buyer MUST be shown the final scope, current quote, selected slot, contact details, and exact action that will occur.
- **FR-020**: Lead submission and booking MUST require an explicit human confirmation that applies to the current final summary; changing the scope, quote, slot, or contact details MUST invalidate an earlier confirmation.
- **FR-021**: Finalization MUST fail safely when the quote is stale or invalid, the selected slot is no longer available, required contact details are missing, or current human confirmation is absent.
- **FR-022**: Successful finalization MUST create no more than one qualified lead and one booking for the confirmed action, including when an identical request is retried.
- **FR-023**: A consultation slot MUST NOT be confirmed for more than one booking.
- **FR-024**: The workspace owner MUST be able to create, edit, activate, and deactivate services, intake fields, supported pricing rules, delivery constraints, incompatible options, and native consultation slots.
- **FR-025**: Pricing-rule changes MUST create a new identifiable version for future quotes without altering historical quote results.
- **FR-026**: Only an authenticated member of the corresponding workspace MUST be able to change seller configuration or view qualified leads and private lead details.
- **FR-027**: A finalized lead view MUST present the confirmed requirements and constraints, provenance, quote snapshot, contact details, booking, and chronological action history as one handoff.
- **FR-028**: Significant scope mutations, quote creation, confirmation, lead submission, and booking attempts MUST record actor type, action type, outcome, and time for later review.
- **FR-029**: The tool inspector MUST list the agent-available capabilities, their read/change classification, and recent invocation outcomes while omitting credentials, private tokens, and unrelated customer data.
- **FR-030**: Public scope access MUST be restricted to the individual unexpired scope and MUST NOT reveal workspace administration data or other scopes.
- **FR-031**: Name and email MUST NOT be required before finalization, and the product MUST request only the contact information needed for the selected next step.
- **FR-032**: Public creation, update, pricing, and finalization attempts MUST be limited sufficiently to prevent a single visitor from degrading availability for other buyers.
- **FR-033**: User- and owner-authored text MUST remain bounded business data and MUST NOT alter capability definitions, access rules, price calculations, or approval requirements.
- **FR-034**: Abandoned draft scopes MUST expire after 30 days; finalized lead and booking retention MUST follow the workspace's disclosed retention policy.
- **FR-035**: The initial workspace MUST offer three realistic seeded services that collectively demonstrate required intake, all four supported pricing-rule types, a timing conflict, an incompatible option, and an under-budget tradeoff.

### Key Entities

- **Workspace**: The service business's sales environment; owns its brand identity, timezone, services, availability, leads, and retention policy.
- **Workspace Member**: An authenticated person permitted to configure and review the workspace; the MVP has one owner role.
- **Service Offering**: A productized professional service with its description, active state, base price, currency, delivery range, inclusions, intake needs, and current version.
- **Scope Field**: A required or optional question that defines a service requirement, including its allowed value type, choices, limits, and display order.
- **Pricing Rule Set**: The versioned collection of base, quantity, option, and conditional adjustments and service constraints used to calculate a quote.
- **Scope Session**: The shared, expiring draft jointly edited by a buyer and agent; contains goal, chosen service, requirements, constraints, status, and provenance.
- **Scope Answer**: One typed requirement or constraint within a scope, together with its latest value, source actor, and update time.
- **Quote**: An immutable calculation for a specific scope and rule version, including range, line items, assumptions, conflicts, calculation time, and current/stale status.
- **Availability Slot**: A consultation interval owned by the workspace, expressed in its timezone and either available, blocked, held, or booked.
- **Booking**: The confirmed association between one finalized scope and one consultation slot, including contact details and confirmation status.
- **Qualified Lead**: The seller-facing commercial handoff produced by finalization, linking the confirmed scope, quote, buyer contact, and optional booking.
- **Audit Event**: A chronological record of a significant human, agent, or system action and its outcome within a workspace or scope.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the scripted end-to-end journey, a first-time buyer can go from a natural-language goal to a confirmed consultation with a complete priced scope in under 3 minutes.
- **SC-002**: At least 90% of representative first-time test users complete service selection, scope review, quote review, and explicit booking confirmation without assistance.
- **SC-003**: Across the deterministic quote test set, 100% of repeated calculations using the same scope and rule version return identical totals and line items, with zero expected-rule mismatches.
- **SC-004**: At least 95% of representative agent journeys choose the correct available capability, provide valid inputs, and reach the expected terminal state without unintended business actions.
- **SC-005**: In 100% of tests, read-only activity and unconfirmed finalization attempts create no lead, booking, or availability change.
- **SC-006**: In a concurrency test with at least 50 attempts to reserve one slot, exactly one booking succeeds and no double booking is recorded.
- **SC-007**: Human or agent edits to a live scope become visible to the other participant within 2 seconds in at least 95% of test interactions.
- **SC-008**: At least 90% of usability-test participants correctly identify which displayed scope values were last set by the human and which were last set by the agent.
- **SC-009**: A workspace owner can configure and publish one template-based service, its intake fields, pricing rules, constraints, and initial availability in under 15 minutes.
- **SC-010**: A newly finalized lead, including its confirmed scope, quote, booking, and action history, is visible to the workspace owner within 5 seconds in at least 95% of tests.
- **SC-011**: All tested historical quotes remain reproducible after a pricing-rule change and visibly retain their original rule version.
- **SC-012**: The complete buyer journey remains usable when agent capabilities are unavailable, with 100% of core actions accessible through the ordinary interface.

## Assumptions

- The challenge MVP demonstrates one fictional small digital agency with three seeded services, one owner, USD pricing, and one workspace timezone; the underlying product model remains reusable for similar service businesses.
- Buyers do not need accounts. Possession of an unexpired, high-entropy scope link grants access only to that scope.
- The external user agent supplies language understanding and tradeoff reasoning. ClientWeave does not embed or operate a proprietary conversational assistant in the MVP.
- Prices are non-binding planning ranges until the service provider reviews the qualified scope; the interface states this clearly.
- Consultation availability is managed natively for the MVP. External calendar and CRM integrations are deferred.
- The next consequential action is lead submission with an optional consultation booking. Payments, contracts, and purchases are deferred.
- The owner provides accurate services, rules, constraints, and availability and is responsible for honoring confirmed consultations.
- Visitors use a modern web browser and may or may not have access to an agent capable of consuming the site's structured sales capabilities.
- The launch market is productized digital and professional services with bounded intake and pricing rules; regulated or advice-sensitive verticals are excluded.
- Abandoned draft scopes contain minimal personal information and expire after 30 days. A production retention policy for finalized leads will be disclosed before commercial launch.
