import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe("database migration contract", () => {
  it("defines the foundational tables, uniqueness boundaries, and foreign keys", async () => {
    const migration = await readFile(
      resolve("supabase/migrations/0000_glamorous_vulcan.sql"),
      "utf8"
    );
    for (const table of [
      "workspaces",
      "service_offerings",
      "service_versions",
      "scope_sessions",
      "scope_participants",
      "quotes",
      "availability_slots",
      "human_confirmations",
      "idempotency_records",
      "qualified_leads",
      "bookings",
      "audit_events"
    ])
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    for (const invariant of [
      'CREATE UNIQUE INDEX "quote_deduplication"',
      'CREATE UNIQUE INDEX "idempotency_key_once"',
      'CONSTRAINT "bookings_slot_id_unique" UNIQUE("slot_id")',
      'CONSTRAINT "qualified_leads_scope_id_unique" UNIQUE("scope_id")',
      'FOREIGN KEY ("scope_id") REFERENCES "public"."scope_sessions"'
    ])
      expect(migration).toContain(invariant);
  });
});

describe.runIf(Boolean(databaseUrl))("migrated PostgreSQL invariants", () => {
  const client = postgres(databaseUrl!, { max: 1, prepare: false });

  afterAll(async () => client.end({ timeout: 5 }));

  it("installs the uniqueness, finalization, RLS, and live-participant boundaries", async () => {
    const [constraints, scopeRevision, rls, indexes, generatedUuid, immutableTriggers] =
      await Promise.all([
        client`
        SELECT conname FROM pg_constraint
        WHERE conname IN (
          'bookings_slot_id_unique',
          'bookings_scope_id_unique',
          'qualified_leads_scope_id_unique'
        )
        ORDER BY conname`,
        client`
        SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'human_confirmations'
          AND column_name = 'scope_revision'`,
        client`
        SELECT relname FROM pg_class
        WHERE relname IN (
          'scope_sessions', 'scope_answers', 'scope_assumptions',
          'quotes', 'availability_slots', 'service_offerings'
        ) AND relrowsecurity`,
        client`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname IN (
            'quote_deduplication', 'idempotency_key_once', 'scope_participants_live_scope_idx'
          )
        ORDER BY indexname`,
        client`
        SELECT uuid_v7()::text AS value`,
        client`
        SELECT tgname FROM pg_trigger
        WHERE tgname IN (
          'service_versions_immutable', 'pricing_rule_sets_immutable', 'pricing_rules_immutable',
          'scope_fields_immutable', 'service_constraints_immutable', 'quotes_immutable'
        )
        AND NOT tgisinternal
        ORDER BY tgname`
      ]);
    expect(constraints.map((constraint) => constraint.conname)).toEqual([
      "bookings_scope_id_unique",
      "bookings_slot_id_unique",
      "qualified_leads_scope_id_unique"
    ]);
    expect(scopeRevision).toEqual([{ data_type: "integer" }]);
    expect(rls).toHaveLength(6);
    expect(indexes.map((index) => index.indexname)).toEqual([
      "idempotency_key_once",
      "quote_deduplication",
      "scope_participants_live_scope_idx"
    ]);
    expect(generatedUuid[0]?.value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(immutableTriggers.map((trigger) => trigger.tgname)).toEqual([
      "pricing_rule_sets_immutable",
      "pricing_rules_immutable",
      "quotes_immutable",
      "scope_fields_immutable",
      "service_constraints_immutable",
      "service_versions_immutable"
    ]);
  });
});
