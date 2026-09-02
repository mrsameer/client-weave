<!--
Sync Impact Report
- Version change: template scaffold -> 1.0.0
- Modified principles:
  - Placeholder Principle 1 -> I. Human Authority Over Consequential Actions
  - Placeholder Principle 2 -> II. Deterministic, Seller-Governed Commerce
  - Placeholder Principle 3 -> III. One Shared and Attributable State
  - Placeholder Principle 4 -> IV. Least Privilege and Bounded Data
  - Placeholder Principle 5 -> V. Auditable Reliability
- Added sections:
  - Product and Experience Constraints
  - Development Workflow and Quality Gates
- Removed sections: none
- Follow-up TODOs: none
-->
# ClientWeave Constitution

## Core Principles

### I. Human Authority Over Consequential Actions
Every discovery, scoping, pricing, and booking workflow MUST remain fully usable through the
ordinary web interface without an agent. An agent MAY draft, explain, compare, and propose
changes, but it MUST NOT submit a lead, reserve a consultation, or perform another consequential
commercial action without explicit human confirmation of the current final summary. Any change to
the scope, quote, selected slot, contact details, or stated action MUST invalidate prior
confirmation. Capability contracts MUST identify read-only operations separately from operations
that mutate business state. This keeps automation useful while leaving commercial authority with
the person affected.

### II. Deterministic, Seller-Governed Commerce
Prices, delivery constraints, compatibility rules, and service eligibility MUST be computed only
from normalized scope data and versioned rules controlled by the seller. Agent-supplied totals or
instructions MUST never override those rules. Identical normalized inputs evaluated against the
same rule version MUST yield identical totals and line items. Every issued quote MUST retain its
rule version, material inputs, assumptions, and itemized calculation; a price-affecting change MUST
mark the prior quote stale rather than alter it silently. This makes every commercial result
reproducible, explainable, and accountable to the business that offers the service.

### III. One Shared and Attributable State
Humans and agents MUST read and update the same durable scope session, never divergent private
copies presented as the current scope. Each material value MUST record its latest source as human,
agent, imported source, or system rule, and the product MUST display that provenance where the
value is reviewed. Mutations MUST return missing requirements and detectable conflicts so all
participants can understand the next valid step. Updates intended for collaboration MUST become
visible to the other participant within the performance target defined by the active feature
specification. Shared, attributable state is required to make collaboration legible and
correctable.

### IV. Least Privilege and Bounded Data
Every public or agent-facing operation MUST expose only the data and authority necessary for its
declared purpose. Public scope access MUST be restricted to one unexpired scope; seller
configuration, private lead data, credentials, tokens, and unrelated customer data MUST remain
inaccessible. Owner-only actions MUST require authentication and workspace authorization.
User-authored and owner-authored text MUST always be treated as bounded business data and MUST NOT
redefine capability contracts, permissions, pricing logic, or approval requirements. Inputs MUST
be validated, public mutations rate-limited, and retained data minimized according to the disclosed
retention policy. These boundaries reduce both accidental disclosure and adversarial misuse.

### V. Auditable Reliability
State-changing operations MUST be safe under retries and concurrency. Finalization MUST be
idempotent, one consultation slot MUST produce at most one confirmed booking, and validation or
availability failures MUST leave no partial lead or booking. Significant mutations, quote creation,
confirmation, finalization, and booking attempts MUST record actor, action, outcome, and time.
Tests MUST cover deterministic pricing, stale-quote rejection, current human confirmation,
authorization boundaries, retry behavior, slot contention, and historical quote reproduction
before the affected workflow is considered complete. Reliability claims MUST be supported by
repeatable tests and inspectable evidence, not inferred from the happy path.

## Product and Experience Constraints

- ClientWeave MUST remain an agent-native service CPQ workspace, not a proprietary conversational
  assistant. Natural-language interpretation and tradeoff reasoning belong to the external agent;
  ClientWeave owns structured capabilities, validation, durable state, and deterministic commerce.
- Agent and ordinary web experiences MUST use the same domain rules and authorization boundaries.
  Neither interface may be a privileged shortcut around validation, approvals, or seller rules.
- Quotes MUST be presented as non-binding planning ranges unless a separately specified and
  approved product change introduces binding commerce.
- Regulated medical, legal, lending, insurance, and financial-advice workflows are outside the
  product boundary unless a future constitutional amendment defines the required safeguards.
- New integrations or automation MUST preserve graceful degradation: core discovery, scoping,
  pricing, and booking remain available when agent capabilities or external services are absent.
- Scope expansion beyond an approved feature specification MUST be documented and approved before
  implementation. Payment, contract acceptance, and other irreversible commerce require their own
  specification and governance review.

## Development Workflow and Quality Gates

1. Every change MUST trace to an approved specification requirement, acceptance scenario, defect,
   or constitutional amendment. Product behavior that is not traceable MUST be removed or formally
   specified before release.
2. Plans and task lists MUST identify applicable constitutional principles and describe how their
   compliance will be verified. Any exception MUST include its scope, risk, owner, and expiry or
   removal plan.
3. Tests MUST be added at the lowest effective level and MUST include integration or concurrency
   coverage where correctness crosses persistence, authorization, pricing versions, or booking
   boundaries. A change MUST NOT merge while its required tests fail.
4. Reviews MUST verify human confirmation, deterministic calculations, provenance, authorization,
   data minimization, idempotency, and auditability whenever the change touches those concerns.
5. Schema and contract changes MUST preserve or deliberately migrate historical quotes, scopes,
   audit events, and capability consumers. Breaking changes require an explicit migration and
   rollback strategy.
6. Each release candidate MUST demonstrate the complete ordinary web journey and the corresponding
   agent capability journey. Security-sensitive data MUST be checked for absence from public
   responses, logs, inspector views, and error messages.

## Governance

This constitution is the highest project-level authority for product design, implementation plans,
and review decisions. When another project artifact conflicts with it, the constitution prevails
until amended.

Amendments MUST be proposed as a documented change that states the motivation, affected principles,
migration impact, and verification plan. Adoption requires explicit approval from the project owner
and updates to affected specifications or plans before dependent implementation proceeds.

Versions follow semantic versioning: MAJOR for removal or incompatible redefinition of a principle
or governance rule, MINOR for a new principle or materially expanded obligation, and PATCH for a
clarification that does not change required behavior. The amendment date MUST match the date the
new version is adopted; the original ratification date remains unchanged.

Every specification and implementation plan MUST include a constitution check. Every pull request
or equivalent review MUST assess applicable principles and record any approved exception. Before a
release, reviewers MUST confirm that exceptions are resolved or remain explicitly accepted with an
owner and expiry. Complexity that weakens these principles MUST be justified with evidence that a
simpler compliant design cannot meet the approved requirements.

**Version**: 1.0.0 | **Ratified**: 2026-09-02 | **Last Amended**: 2026-09-02
