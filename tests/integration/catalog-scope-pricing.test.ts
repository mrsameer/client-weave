import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CatalogRepository } from "../../src/db/repositories/catalog-repository";
import { QuoteRepository } from "../../src/db/repositories/quote-repository";
import { ScopeRepository } from "../../src/db/repositories/scope-repository";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.runIf(Boolean(databaseUrl))("catalog, scope, and quote persistence", () => {
  const client = postgres(databaseUrl!, { max: 1, prepare: false });
  const db = drizzle(client);
  const catalog = new CatalogRepository(db);
  const scopes = new ScopeRepository(db);
  const quotes = new QuoteRepository(db);
  const ids = {
    workspace: randomUUID(),
    activeService: randomUUID(),
    inactiveService: randomUUID(),
    activeVersion: randomUUID(),
    inactiveVersion: randomUUID(),
    activeRuleSet: randomUUID(),
    inactiveRuleSet: randomUUID()
  };

  beforeAll(async () => {
    await client`
      INSERT INTO workspaces (id, name, timezone)
      VALUES (${ids.workspace}, 'Catalog scope pricing', 'UTC')`;
    await client`
      INSERT INTO service_offerings (id, workspace_id, slug, active)
      VALUES
        (${ids.activeService}, ${ids.workspace}, 'active-service', true),
        (${ids.inactiveService}, ${ids.workspace}, 'inactive-service', false)`;
    await client`
      INSERT INTO service_versions (
        id, service_id, version, name, description, base_price_minor, currency,
        delivery_min_days, delivery_max_days, included_items
      ) VALUES
        (${ids.activeVersion}, ${ids.activeService}, 1, 'Active service', 'Visible', 10000, 'USD', 1, 7, '[]'::jsonb),
        (${ids.inactiveVersion}, ${ids.inactiveService}, 1, 'Inactive service', 'Hidden', 20000, 'USD', 1, 7, '[]'::jsonb)`;
    await client`
      UPDATE service_offerings SET active_version_id = CASE id
        WHEN ${ids.activeService} THEN ${ids.activeVersion}::uuid
        WHEN ${ids.inactiveService} THEN ${ids.inactiveVersion}::uuid
      END WHERE id IN (${ids.activeService}, ${ids.inactiveService})`;
    await client`
      INSERT INTO pricing_rule_sets (id, service_version_id, version, evaluator_version, content_hash)
      VALUES
        (${ids.activeRuleSet}, ${ids.activeVersion}, 1, 'v1', 'active-rules'),
        (${ids.inactiveRuleSet}, ${ids.inactiveVersion}, 1, 'v1', 'inactive-rules')`;
  });

  afterAll(async () => client.end({ timeout: 5 }));

  it("returns only active services and selects their current pricing rule set", async () => {
    expect((await catalog.listPublicActive()).map((service) => service.slug)).toContain(
      "active-service"
    );
    expect((await catalog.listPublicActive()).map((service) => service.slug)).not.toContain(
      "inactive-service"
    );
    await expect(catalog.getCurrentPricing(ids.activeService)).resolves.toMatchObject({
      ruleSetId: ids.activeRuleSet,
      ruleSetVersion: 1,
      currency: "USD"
    });
  });

  it("persists a 30-day scope and deduplicates immutable quote snapshots", async () => {
    const createdAt = new Date("2026-09-04T00:00:00.000Z");
    const scope = await scopes.create({
      ref: `catalog-scope-${randomUUID()}`,
      serviceId: ids.activeService,
      goal: "Launch the active service",
      budgetMaxMinor: 30000,
      targetDeliveryDate: new Date("2026-10-01T00:00:00.000Z"),
      assumptions: ["Buyer provides copy"],
      answers: { pages: 6 },
      actor: "HUMAN",
      expiresAt: new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000),
      tokenHash: `catalog-token-${randomUUID()}`
    });
    expect(scope.expiresAt.getTime()).toBe(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    const quoteInput = {
      scopeId: scope.id,
      scopeRevision: 1,
      ruleSetId: ids.activeRuleSet,
      inputHash: "same-canonical-input",
      snapshot: { lineItems: [{ label: "Base", amountMinor: 10000 }], ruleSetVersion: 1 },
      totalMinor: 10000
    };
    const [first, duplicate] = await Promise.all([
      quotes.persist(quoteInput),
      quotes.persist(quoteInput)
    ]);
    expect(first.id).toBe(duplicate.id);
    await expect(client`UPDATE quotes SET total_minor = 1 WHERE id = ${first.id}`).rejects.toThrow(
      /quotes history is immutable/
    );
    expect(await quotes.latestForScope(scope.id)).toMatchObject({
      id: first.id,
      snapshot: quoteInput.snapshot,
      totalMinor: 10000
    });
  });
});
