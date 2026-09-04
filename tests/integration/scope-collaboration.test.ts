import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { QuoteRepository } from "../../src/db/repositories/quote-repository";
import { ScopeRepository } from "../../src/db/repositories/scope-repository";
import { ScopeBroadcast } from "../../src/server/realtime/scope-broadcast";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.runIf(Boolean(databaseUrl))("scope collaboration persistence", () => {
  const client = postgres(databaseUrl!, { max: 1, prepare: false });
  const db = drizzle(client);
  const scopes = new ScopeRepository(db);
  const quotes = new QuoteRepository(db);
  const ids = {
    workspace: randomUUID(),
    service: randomUUID(),
    version: randomUUID(),
    ruleSet: randomUUID()
  };
  let scopeId = "";

  beforeAll(async () => {
    await client`
      INSERT INTO workspaces (id, name, timezone) VALUES (${ids.workspace}, 'Collaboration test', 'UTC')`;
    await client`
      INSERT INTO service_offerings (id, workspace_id, slug, active)
      VALUES (${ids.service}, ${ids.workspace}, 'collaboration', true)`;
    await client`
      INSERT INTO service_versions (
        id, service_id, version, name, description, base_price_minor, currency,
        delivery_min_days, delivery_max_days, included_items
      ) VALUES (
        ${ids.version}, ${ids.service}, 1, 'Collaboration', 'Fixture', 1000, 'USD', 1, 7, '[]'::jsonb
      )`;
    await client`
      INSERT INTO pricing_rule_sets (id, service_version_id, version, evaluator_version, content_hash)
      VALUES (${ids.ruleSet}, ${ids.version}, 1, 'v1', 'fixture')`;
    const created = await scopes.create({
      ref: `scope-${randomUUID()}`,
      serviceId: ids.service,
      goal: "Launch a website",
      budgetMaxMinor: 20_000,
      targetDeliveryDate: new Date("2026-10-01T00:00:00Z"),
      assumptions: ["Buyer supplies copy"],
      answers: { pages: 3, tone: "warm" },
      actor: "HUMAN",
      expiresAt: new Date("2026-11-01T00:00:00Z"),
      tokenHash: `token-${randomUUID()}`
    });
    scopeId = created.id;
    await client`
      INSERT INTO human_confirmations (scope_id, scope_revision, summary_hash, expires_at)
      VALUES (${scopeId}, 1, ${"a".repeat(64)}, now() + interval '1 hour')`;
    await quotes.persist({
      scopeId,
      scopeRevision: 1,
      ruleSetId: ids.ruleSet,
      inputHash: "initial",
      snapshot: { totalMinor: 1000 },
      totalMinor: 1000
    });
  });

  afterAll(async () => client.end({ timeout: 5 }));

  it("writes changed values, provenance, audit, and confirmation invalidation atomically", async () => {
    const updated = await scopes.update(scopeId, {
      expectedRevision: 1,
      actor: "AGENT",
      goal: "Launch an accessible website",
      budgetMaxMinor: 18_000,
      targetDeliveryDate: new Date("2026-10-15T00:00:00Z"),
      assumptions: ["Buyer supplies copy", "Accessibility review is included"],
      answers: { pages: 5, tone: "clear" }
    });
    expect(updated).toMatchObject({
      revision: 2,
      goalActor: "AGENT",
      budgetMaxMinor: 18_000,
      budgetActor: "AGENT",
      deliveryActor: "AGENT",
      assumptions: [
        expect.objectContaining({ value: "Buyer supplies copy", actor: "HUMAN" }),
        expect.objectContaining({ value: "Accessibility review is included", actor: "AGENT" })
      ],
      answers: {
        pages: expect.objectContaining({ value: 5, actor: "AGENT" }),
        tone: expect.objectContaining({ value: "clear", actor: "AGENT" })
      }
    });
    const [confirmations, events] = await Promise.all([
      client`SELECT invalidated_at IS NOT NULL AS invalidated FROM human_confirmations WHERE scope_id = ${scopeId}`,
      client`SELECT actor, action, metadata FROM audit_events WHERE scope_id = ${scopeId}`
    ]);
    expect(confirmations[0]?.invalidated).toBe(true);
    expect(events).toEqual([
      expect.objectContaining({
        actor: "AGENT",
        action: "SCOPE_UPDATED",
        metadata: { revision: 2 }
      })
    ]);
  });

  it("rejects stale revisions, leaves the prior quote stale, and authorizes only its private topic", async () => {
    expect(
      await scopes.update(scopeId, {
        expectedRevision: 1,
        actor: "HUMAN",
        goal: "This stale write must not apply"
      })
    ).toBeNull();
    const scope = await scopes.getById(scopeId);
    const quote = await quotes.latestForScope(scopeId);
    expect(scope.revision).toBe(2);
    expect(quote?.scopeRevision).toBe(1);
    expect(quote?.scopeRevision).not.toBe(scope.revision);

    const broadcast = new ScopeBroadcast();
    const received: number[] = [];
    const stop = broadcast.subscribe(
      { scopeId, expiresAt: new Date("2026-11-01T00:00:00Z"), revokedAt: null },
      (event) => received.push(event.revision)
    );
    broadcast.publish({ scopeId: randomUUID(), revision: 9, changedAt: new Date().toISOString() });
    broadcast.publish({ scopeId, revision: scope.revision, changedAt: new Date().toISOString() });
    stop();
    expect(received).toEqual([2]);
  });
});
