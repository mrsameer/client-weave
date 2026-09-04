# Operations

## Migrations and rollback

Supabase migrations are append-only. Apply them in order and use a backup plus a
forward corrective migration to recover from a deployment issue; do not rewrite
published service versions, issued quotes, confirmations, bookings, or audit
events. Generated schema migrations establish the base tables, while policy and
realtime migrations follow it.

## Pricing compatibility

Quotes preserve their input hash, rule-set reference, evaluator version, and
line items. A new pricing rule or evaluator version affects new quotes only.
Historical quote replay must select the retained evaluator from its snapshot;
it must never use a buyer- or agent-provided total.

## Threat boundaries

The browser capability proves access to a single scope, not to a workspace.
Owner actions require a matching active owner membership. Human confirmation is
recorded only by the ordinary UI endpoint and is bound to its exact final
summary. Read-only discovery and availability must not create leads, bookings,
or holds. Logs, inspector records, errors, and realtime invalidations omit raw
secrets, contact details, and untrusted prose.

## Retention

The Vercel cron calls `/api/internal/retention` daily using
`RETENTION_CRON_SECRET`. The service expires overdue draft scopes and revokes
their participants. It also removes finalized scope, lead, booking, quote,
confirmation, and capability records after the workspace's `retention_days`
policy, retaining a workspace-level deletion audit event without the deleted
scope reference.
