import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LeadRepository } from "../../src/db/repositories/lead-repository";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.runIf(Boolean(databaseUrl))("lead handoff persistence", () => {
  const client = postgres(databaseUrl!, { max: 1, prepare: false });
  const repository = new LeadRepository(drizzle(client));
  const ids = {
    workspace: randomUUID(),
    otherWorkspace: randomUUID(),
    service: randomUUID(),
    version: randomUUID(),
    rules: randomUUID(),
    scope: randomUUID(),
    quote: randomUUID(),
    lead: randomUUID(),
    slot: randomUUID()
  };

  beforeAll(async () => {
    await client`
      INSERT INTO workspaces (id, name, timezone)
      VALUES (${ids.workspace}, 'Lead review', 'UTC'), (${ids.otherWorkspace}, 'Other', 'UTC')`;
    await client`
      INSERT INTO service_offerings (id, workspace_id, slug, active)
      VALUES (${ids.service}, ${ids.workspace}, 'lead-review', true)`;
    await client`
      INSERT INTO service_versions (
        id, service_id, version, name, description, base_price_minor, currency,
        delivery_min_days, delivery_max_days, included_items
      ) VALUES (${ids.version}, ${ids.service}, 1, 'Lead review', 'Fixture', 10000, 'USD', 1, 7, '[]'::jsonb)`;
    await client`
      INSERT INTO pricing_rule_sets (id, service_version_id, version, evaluator_version, content_hash)
      VALUES (${ids.rules}, ${ids.version}, 1, 'v1', 'lead-review')`;
    await client`
      INSERT INTO scope_sessions (
        id, ref, service_id, revision, goal, goal_actor, budget_max_minor, budget_actor,
        target_delivery_date, delivery_actor, expires_at, finalized_at
      ) VALUES (
        ${ids.scope}, ${`lead-review-${ids.scope}`}, ${ids.service}, 3, 'Launch a reviewed website', 'HUMAN',
        30000, 'AGENT', '2026-10-01T00:00:00Z', 'HUMAN', now() + interval '1 day', now()
      )`;
    await client`
      INSERT INTO quotes (id, scope_id, scope_revision, rule_set_id, input_hash, snapshot, total_minor)
      VALUES (${ids.quote}, ${ids.scope}, 3, ${ids.rules}, 'lead-review', '{"ruleVersion":1}'::jsonb, 25000)`;
    await client`
      INSERT INTO qualified_leads (id, scope_id, quote_id, contact)
      VALUES (${ids.lead}, ${ids.scope}, ${ids.quote}, '{"name":"Buyer","email":"buyer@example.test"}'::jsonb)`;
    await client`
      INSERT INTO availability_slots (id, workspace_id, starts_at, ends_at, status)
      VALUES (${ids.slot}, ${ids.workspace}, now() + interval '2 days', now() + interval '2 days 30 minutes', 'BOOKED')`;
    await client`
      INSERT INTO bookings (scope_id, slot_id, lead_id) VALUES (${ids.scope}, ${ids.slot}, ${ids.lead})`;
    await client`
      INSERT INTO scope_assumptions (scope_id, value, actor, display_order)
      VALUES (${ids.scope}, 'Buyer provides copy', 'HUMAN', 0)`;
    await client`
      INSERT INTO scope_answers (scope_id, field_key, value, actor)
      VALUES (${ids.scope}, 'pages', '6'::jsonb, 'AGENT')`;
    await client`
      INSERT INTO audit_events (workspace_id, scope_id, actor, action, outcome, metadata, created_at)
      VALUES
        (${ids.workspace}, ${ids.scope}, 'HUMAN', 'SCOPE_CREATED', 'SUCCEEDED', '{}'::jsonb, now() - interval '2 minutes'),
        (${ids.workspace}, ${ids.scope}, 'AGENT', 'SCOPE_UPDATED', 'SUCCEEDED', '{"revision":2}'::jsonb, now() - interval '1 minute'),
        (${ids.workspace}, ${ids.scope}, 'SYSTEM', 'SCOPE_FINALIZED', 'SUCCEEDED', '{"quoteId":"fixture"}'::jsonb, now())`;
  });

  afterAll(async () => client.end({ timeout: 5 }));

  it("projects one workspace-scoped lead with provenance, quote replay metadata, booking, and chronological activity", async () => {
    const startedAt = performance.now();
    const [listed] = await repository.listForWorkspace(ids.workspace);
    const handoff = await repository.getForWorkspace(ids.workspace, ids.lead);
    expect(performance.now() - startedAt).toBeLessThan(5_000);
    expect(listed).toMatchObject({
      id: ids.lead,
      goal: "Launch a reviewed website",
      quoteTotalMinor: 25000,
      bookingId: expect.any(String)
    });
    expect(handoff).toMatchObject({
      id: ids.lead,
      contact: { name: "Buyer", email: "buyer@example.test" },
      quoteSnapshot: { ruleVersion: 1 },
      bookingId: expect.any(String),
      assumptions: [expect.objectContaining({ value: "Buyer provides copy", actor: "HUMAN" })],
      answers: [expect.objectContaining({ field: "pages", value: 6, actor: "AGENT" })]
    });
    expect(handoff?.activity.map((event) => event.action)).toEqual([
      "SCOPE_CREATED",
      "SCOPE_UPDATED",
      "SCOPE_FINALIZED"
    ]);
  });

  it("does not enumerate another workspace's lead", async () => {
    expect(await repository.listForWorkspace(ids.otherWorkspace)).toEqual([]);
    expect(await repository.getForWorkspace(ids.otherWorkspace, ids.lead)).toBeNull();
  });
});
