import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FinalizationRepository } from "../../src/db/repositories/finalization-repository";
import { finalizeConfirmedScope } from "../../src/modules/finalization/application/finalize-confirmed-scope";

const databaseUrl = process.env.TEST_DATABASE_URL;
const summaryHash = "a".repeat(64);
const ids = {
  workspace: "00000000-0000-4000-8000-000000000001",
  service: "00000000-0000-4000-8000-000000000002",
  version: "00000000-0000-4000-8000-000000000003",
  rules: "00000000-0000-4000-8000-000000000004",
  scope: "00000000-0000-4000-8000-000000000005",
  quote: "00000000-0000-4000-8000-000000000006",
  slot: "00000000-0000-4000-8000-000000000007"
};

/**
 * Requires a migrated disposable PostgreSQL database. The test intentionally
 * uses 50 separate max-one-connection clients so pool serialization cannot
 * conceal a slot-contention defect.
 */
describe.runIf(Boolean(databaseUrl))("single-slot finalization contention", () => {
  const admin = postgres(databaseUrl!, { max: 1, prepare: false });

  beforeAll(async () => {
    await admin.unsafe(
      "TRUNCATE bookings, qualified_leads, idempotency_records, human_confirmations, quotes, availability_slots, scope_sessions, pricing_rule_sets, service_versions, service_offerings, workspaces CASCADE"
    );
    await admin`
      INSERT INTO workspaces (id, name, timezone)
      VALUES (${ids.workspace}, 'Contention test', 'UTC')`;
    await admin`
      INSERT INTO service_offerings (id, workspace_id, slug, active)
      VALUES (${ids.service}, ${ids.workspace}, 'contention', true)`;
    await admin`
      INSERT INTO service_versions (id, service_id, version, name, description, base_price_minor, currency, delivery_min_days, delivery_max_days, included_items)
      VALUES (${ids.version}, ${ids.service}, 1, 'Contention', 'Contention fixture', 10000, 'USD', 1, 1, '[]'::jsonb)`;
    await admin`
      INSERT INTO pricing_rule_sets (id, service_version_id, version, evaluator_version, content_hash)
      VALUES (${ids.rules}, ${ids.version}, 1, 'v1', 'fixture')`;
    await admin`
      INSERT INTO scope_sessions (id, ref, service_id, revision, goal, goal_actor, budget_max_minor, budget_actor, delivery_actor, expires_at)
      VALUES (${ids.scope}, 'contention-scope-ref', ${ids.service}, 1, 'Book one slot', 'HUMAN', 10000, 'HUMAN', 'HUMAN', now() + interval '1 hour')`;
    await admin`
      INSERT INTO quotes (id, scope_id, scope_revision, rule_set_id, input_hash, snapshot, total_minor)
      VALUES (${ids.quote}, ${ids.scope}, 1, ${ids.rules}, 'fixture', '{}'::jsonb, 10000)`;
    await admin`
      INSERT INTO human_confirmations (scope_id, scope_revision, summary_hash, expires_at)
      VALUES (${ids.scope}, 1, ${summaryHash}, now() + interval '10 minutes')`;
    await admin`
      INSERT INTO availability_slots (id, workspace_id, starts_at, ends_at, status)
      VALUES (${ids.slot}, ${ids.workspace}, now() + interval '2 hours', now() + interval '3 hours', 'AVAILABLE')`;
  });

  afterAll(async () => {
    await admin.end({ timeout: 5 });
  });

  it("allows exactly one of 50 independent finalizations to book, with no loser partial state", async () => {
    const clients = Array.from({ length: 50 }, () =>
      postgres(databaseUrl!, { max: 1, prepare: false })
    );
    try {
      const attempts = await Promise.allSettled(
        clients.map((client, index) =>
          finalizeConfirmedScope(new FinalizationRepository(drizzle(client)), {
            scopeId: ids.scope,
            workspaceId: ids.workspace,
            scopeRevision: 1,
            quoteId: ids.quote,
            summaryHash,
            action: "SUBMIT_LEAD_AND_BOOK",
            slotId: ids.slot,
            contact: { name: "Concurrency" },
            idempotencyKey: `contention-${index}`
          })
        )
      );
      const successful = attempts.filter(
        (attempt) => attempt.status === "fulfilled" && attempt.value.ok
      );
      expect(successful).toHaveLength(1);
      const [leads, bookings, idempotency, slot] = await Promise.all([
        admin`SELECT id FROM qualified_leads WHERE scope_id = ${ids.scope}`,
        admin`SELECT id FROM bookings WHERE scope_id = ${ids.scope}`,
        admin`SELECT id FROM idempotency_records WHERE scope_id = ${ids.scope}`,
        admin`SELECT status FROM availability_slots WHERE id = ${ids.slot}`
      ]);
      expect(leads).toHaveLength(1);
      expect(bookings).toHaveLength(1);
      expect(idempotency).toHaveLength(1);
      expect(slot[0]?.status).toBe("BOOKED");
    } finally {
      await Promise.all(clients.map((client) => client.end({ timeout: 5 })));
    }
  });
});

if (!databaseUrl)
  throw new Error(
    "TEST_DATABASE_URL is required for concurrency tests; run migrations against a disposable PostgreSQL database first."
  );
