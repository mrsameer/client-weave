import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FinalizationRepository } from "../../src/db/repositories/finalization-repository";
import { FinalizationTransactionError } from "../../src/db/repositories/finalization-repository";
import { finalizeConfirmedScope } from "../../src/modules/finalization/application/finalize-confirmed-scope";

const databaseUrl = process.env.TEST_DATABASE_URL;
const summaryHash = "a".repeat(64);

describe.runIf(Boolean(databaseUrl))("finalization persistence", () => {
  const client = postgres(databaseUrl!, { max: 1, prepare: false });
  const repository = new FinalizationRepository(drizzle(client));
  const ids = {
    workspace: randomUUID(),
    service: randomUUID(),
    version: randomUUID(),
    ruleSet: randomUUID()
  };

  beforeAll(async () => {
    await client`
      INSERT INTO workspaces (id, name, timezone)
      VALUES (${ids.workspace}, 'Finalization integration', 'UTC')`;
    await client`
      INSERT INTO service_offerings (id, workspace_id, slug, active)
      VALUES (${ids.service}, ${ids.workspace}, 'finalization-integration', true)`;
    await client`
      INSERT INTO service_versions (
        id, service_id, version, name, description, base_price_minor, currency,
        delivery_min_days, delivery_max_days, included_items
      ) VALUES (
        ${ids.version}, ${ids.service}, 1, 'Finalization integration', 'Fixture',
        10000, 'USD', 1, 7, '[]'::jsonb
      )`;
    await client`
      INSERT INTO pricing_rule_sets (id, service_version_id, version, evaluator_version, content_hash)
      VALUES (${ids.ruleSet}, ${ids.version}, 1, 'v1', 'finalization-integration')`;
  });

  afterAll(async () => client.end({ timeout: 5 }));

  async function seedCurrentScope() {
    const scopeId = randomUUID();
    const quoteId = randomUUID();
    await client`
      INSERT INTO scope_sessions (
        id, ref, service_id, revision, goal, goal_actor, budget_max_minor,
        budget_actor, delivery_actor, expires_at
      ) VALUES (
        ${scopeId}, ${`finalization-${scopeId}`}, ${ids.service}, 1, 'Book a consultation',
        'HUMAN', 10000, 'HUMAN', 'HUMAN', now() + interval '1 hour'
      )`;
    await client`
      INSERT INTO quotes (id, scope_id, scope_revision, rule_set_id, input_hash, snapshot, total_minor)
      VALUES (${quoteId}, ${scopeId}, 1, ${ids.ruleSet}, ${`quote-${scopeId}`}, '{}'::jsonb, 10000)`;
    await client`
      INSERT INTO human_confirmations (scope_id, scope_revision, summary_hash, expires_at)
      VALUES (${scopeId}, 1, ${summaryHash}, now() + interval '10 minutes')`;
    return { scopeId, quoteId };
  }

  function input(scopeId: string, quoteId: string, idempotencyKey: string, hash = summaryHash) {
    return {
      scopeId,
      workspaceId: ids.workspace,
      scopeRevision: 1,
      quoteId,
      summaryHash: hash,
      action: "SUBMIT_LEAD" as const,
      contact: { name: "Integration buyer", email: "buyer@example.test" },
      idempotencyKey
    };
  }

  it("rejects stale confirmation before creating a lead, audit event, or idempotency response", async () => {
    const { scopeId, quoteId } = await seedCurrentScope();
    await expect(
      finalizeConfirmedScope(
        repository,
        input(scopeId, quoteId, "stale-confirmation-key", "b".repeat(64))
      )
    ).rejects.toMatchObject({
      code: "CONFIRMATION_STALE"
    } satisfies Partial<FinalizationTransactionError>);
    const [leads, audit, idempotency] = await Promise.all([
      client`SELECT id FROM qualified_leads WHERE scope_id = ${scopeId}`,
      client`SELECT id FROM audit_events WHERE scope_id = ${scopeId}`,
      client`SELECT response FROM idempotency_records WHERE scope_id = ${scopeId}`
    ]);
    expect(leads).toHaveLength(0);
    expect(audit).toHaveLength(0);
    expect(idempotency).toHaveLength(0);
  });

  it("replays one successful idempotent finalization and rejects a changed reuse", async () => {
    const { scopeId, quoteId } = await seedCurrentScope();
    const firstInput = input(scopeId, quoteId, "idempotent-finalization-key");
    const first = await finalizeConfirmedScope(repository, firstInput);
    const replay = await finalizeConfirmedScope(repository, firstInput);
    const changedReuse = await finalizeConfirmedScope(repository, {
      ...firstInput,
      contact: { name: "Changed buyer", email: "buyer@example.test" }
    });

    expect(first).toMatchObject({ ok: true, replayed: false });
    expect(replay).toMatchObject({
      ok: true,
      replayed: true,
      response: first.ok ? first.response : {}
    });
    expect(changedReuse).toEqual({ ok: false, code: "IDEMPOTENCY_KEY_REUSED" });
    const [leads, events, records] = await Promise.all([
      client`SELECT id FROM qualified_leads WHERE scope_id = ${scopeId}`,
      client`SELECT action, outcome FROM audit_events WHERE scope_id = ${scopeId}`,
      client`SELECT response FROM idempotency_records WHERE scope_id = ${scopeId}`
    ]);
    expect(leads).toHaveLength(1);
    expect(events).toEqual([{ action: "SCOPE_FINALIZED", outcome: "SUCCEEDED" }]);
    expect(records).toHaveLength(1);
  });

  it("rolls back all consequential writes for a stale quote or unavailable slot", async () => {
    const staleQuote = await seedCurrentScope();
    const staleQuoteId = randomUUID();
    await client`
      INSERT INTO quotes (id, scope_id, scope_revision, rule_set_id, input_hash, snapshot, total_minor)
      VALUES (${staleQuoteId}, ${staleQuote.scopeId}, 2, ${ids.ruleSet}, ${`stale-${staleQuote.scopeId}`}, '{}'::jsonb, 10000)`;
    await expect(
      finalizeConfirmedScope(repository, input(staleQuote.scopeId, staleQuoteId, "stale-quote-key"))
    ).rejects.toMatchObject({
      code: "QUOTE_STALE"
    } satisfies Partial<FinalizationTransactionError>);

    const unavailableSlot = await seedCurrentScope();
    const slotId = randomUUID();
    await client`
      INSERT INTO availability_slots (id, workspace_id, starts_at, ends_at, status)
      VALUES (${slotId}, ${ids.workspace}, now() + interval '2 hours', now() + interval '3 hours', 'BLOCKED')`;
    await expect(
      finalizeConfirmedScope(repository, {
        ...input(unavailableSlot.scopeId, unavailableSlot.quoteId, "blocked-slot-key"),
        action: "SUBMIT_LEAD_AND_BOOK",
        slotId
      })
    ).rejects.toMatchObject({
      code: "SLOT_UNAVAILABLE"
    } satisfies Partial<FinalizationTransactionError>);

    const [staleLeads, blockedLeads, slot] = await Promise.all([
      client`SELECT id FROM qualified_leads WHERE scope_id = ${staleQuote.scopeId}`,
      client`SELECT id FROM qualified_leads WHERE scope_id = ${unavailableSlot.scopeId}`,
      client`SELECT status FROM availability_slots WHERE id = ${slotId}`
    ]);
    expect(staleLeads).toHaveLength(0);
    expect(blockedLeads).toHaveLength(0);
    expect(slot).toEqual([{ status: "BLOCKED" }]);
  });
});
