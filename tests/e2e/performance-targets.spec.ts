import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { expect, test } from "@playwright/test";
import { FinalizationRepository } from "../../src/db/repositories/finalization-repository";
import { LeadRepository } from "../../src/db/repositories/lead-repository";
import { ScopeRepository } from "../../src/db/repositories/scope-repository";
import { finalizeConfirmedScope } from "../../src/modules/finalization/application/finalize-confirmed-scope";

const databaseUrl = process.env.TEST_DATABASE_URL;
const enabled = ["local", "ci"].includes(process.env.PERFORMANCE_PROFILE ?? "");
const summaryHash = "a".repeat(64);

function percentile95(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Infinity;
}

test.describe("release performance targets", () => {
  test.skip(
    !databaseUrl || !enabled,
    "requires TEST_DATABASE_URL and PERFORMANCE_PROFILE=local|ci"
  );
  test.describe.configure({ mode: "serial" });
  const client = postgres(databaseUrl!, { max: 4, prepare: false });
  const db = drizzle(client);
  const scopes = new ScopeRepository(db);
  const finalizations = new FinalizationRepository(db);
  const leads = new LeadRepository(db);
  const ids = {
    workspace: randomUUID(),
    service: randomUUID(),
    version: randomUUID(),
    rules: randomUUID()
  };

  test.beforeAll(async () => {
    await client`INSERT INTO workspaces (id, name, timezone) VALUES (${ids.workspace}, 'Performance profile', 'UTC')`;
    await client`INSERT INTO service_offerings (id, workspace_id, slug, active) VALUES (${ids.service}, ${ids.workspace}, ${`performance-${ids.service.slice(0, 8)}`}, true)`;
    await client`INSERT INTO service_versions (id, service_id, version, name, description, base_price_minor, currency, delivery_min_days, delivery_max_days, included_items) VALUES (${ids.version}, ${ids.service}, 1, 'Performance service', 'Fixture', 10000, 'USD', 1, 7, '[]'::jsonb)`;
    await client`UPDATE service_offerings SET active_version_id = ${ids.version} WHERE id = ${ids.service}`;
    await client`INSERT INTO pricing_rule_sets (id, service_version_id, version, evaluator_version, content_hash) VALUES (${ids.rules}, ${ids.version}, 1, 'v1', 'performance')`;
  });
  test.afterAll(async () => client.end({ timeout: 5 }));

  async function seedScope(prefix: string) {
    const scopeId = randomUUID();
    const quoteId = randomUUID();
    await client`INSERT INTO scope_sessions (id, ref, service_id, revision, goal, goal_actor, budget_max_minor, budget_actor, delivery_actor, expires_at) VALUES (${scopeId}, ${`${prefix}-${scopeId}`}, ${ids.service}, 1, 'Launch a website', 'HUMAN', 10000, 'HUMAN', 'HUMAN', now() + interval '1 hour')`;
    await client`INSERT INTO quotes (id, scope_id, scope_revision, rule_set_id, input_hash, snapshot, total_minor) VALUES (${quoteId}, ${scopeId}, 1, ${ids.rules}, ${`quote-${scopeId}`}, '{}'::jsonb, 10000)`;
    await client`INSERT INTO human_confirmations (scope_id, scope_revision, summary_hash, expires_at) VALUES (${scopeId}, 1, ${summaryHash}, now() + interval '10 minutes')`;
    return { scopeId, quoteId };
  }

  test("measures 100 alternating updates over ten fresh scopes", async () => {
    const warmup = await seedScope("performance-warmup");
    await scopes.update(warmup.scopeId, { expectedRevision: 1, actor: "HUMAN", goal: "Warm-up" });
    const cohort = await Promise.all(
      Array.from({ length: 10 }, () => seedScope("performance-update"))
    );
    const interactionDurations: number[] = [];
    const convergenceDurations: number[] = [];
    for (let index = 0; index < 100; index += 1) {
      const fixture = cohort[index % cohort.length]!;
      const current = await scopes.getById(fixture.scopeId);
      const startedAt = performance.now();
      const committed = await scopes.update(fixture.scopeId, {
        expectedRevision: current.revision,
        actor: index % 2 === 0 ? "HUMAN" : "AGENT",
        goal: `Measured update ${index}`
      });
      const acknowledgedAt = performance.now();
      const observed = await scopes.getById(fixture.scopeId);
      const observedAt = performance.now();
      expect(committed?.revision).toBe(current.revision + 1);
      expect(observed.goal).toBe(`Measured update ${index}`);
      interactionDurations.push(acknowledgedAt - startedAt);
      convergenceDurations.push(observedAt - acknowledgedAt);
    }
    const converged = convergenceDurations.filter((duration) => duration < 2_000).length;
    expect(converged).toBeGreaterThanOrEqual(95);
    expect(percentile95(interactionDurations)).toBeLessThan(500);
    console.info(
      JSON.stringify({
        profile: process.env.PERFORMANCE_PROFILE,
        environment: "postgres-authoritative-read",
        warmupsExcluded: 1,
        monotonicClock: "performance.now",
        updates: 100,
        convergedWithinTwoSeconds: converged,
        interactionP95Milliseconds: percentile95(interactionDurations)
      })
    );
  });

  test("measures 20 fresh finalizations becoming owner-visible", async () => {
    const warmup = await seedScope("performance-finalization-warmup");
    await finalizeConfirmedScope(finalizations, {
      scopeId: warmup.scopeId,
      workspaceId: ids.workspace,
      scopeRevision: 1,
      quoteId: warmup.quoteId,
      summaryHash,
      action: "SUBMIT_LEAD",
      contact: { email: "warmup@example.test" },
      idempotencyKey: `warmup-${randomUUID()}`
    });
    const durations: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      const fixture = await seedScope("performance-finalization");
      const result = await finalizeConfirmedScope(finalizations, {
        scopeId: fixture.scopeId,
        workspaceId: ids.workspace,
        scopeRevision: 1,
        quoteId: fixture.quoteId,
        summaryHash,
        action: "SUBMIT_LEAD",
        contact: { email: `buyer-${index}@example.test` },
        idempotencyKey: `performance-${randomUUID()}`
      });
      const acknowledgedAt = performance.now();
      expect(result.ok).toBe(true);
      const visible = await leads.listForWorkspace(ids.workspace);
      const observedAt = performance.now();
      expect(visible.some((lead) => lead.scopeRef.includes(fixture.scopeId))).toBe(true);
      durations.push(observedAt - acknowledgedAt);
    }
    const ownerVisible = durations.filter((duration) => duration < 5_000).length;
    expect(ownerVisible).toBeGreaterThanOrEqual(19);
    console.info(
      JSON.stringify({
        profile: process.env.PERFORMANCE_PROFILE,
        environment: "postgres-owner-read",
        warmupsExcluded: 1,
        monotonicClock: "performance.now",
        finalizations: 20,
        ownerVisibleWithinFiveSeconds: ownerVisible
      })
    );
  });
});
