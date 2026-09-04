import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, test } from "@playwright/test";
import { ensureOwnerAuthStub, ownerEmailFor } from "./owner-auth-stub";

const databaseUrl = process.env.TEST_DATABASE_URL;
const ids = {
  workspace: randomUUID(),
  owner: randomUUID(),
  service: randomUUID(),
  version: randomUUID(),
  ruleSet: randomUUID(),
  scope: randomUUID(),
  quote: randomUUID(),
  lead: randomUUID(),
  slot: randomUUID()
};

test.skip(!databaseUrl, "requires TEST_DATABASE_URL and local owner-auth test configuration");

test.beforeAll(async () => {
  await ensureOwnerAuthStub();
  const client = postgres(databaseUrl!, { max: 1, prepare: false });
  try {
    await client`
      INSERT INTO workspaces (id, name, timezone) VALUES (${ids.workspace}, 'Owner lead browser', 'UTC')`;
    await client`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES (${ids.workspace}, ${ids.owner}, 'OWNER')`;
    await client`
      INSERT INTO service_offerings (id, workspace_id, slug, active)
      VALUES (${ids.service}, ${ids.workspace}, 'lead-browser', true)`;
    await client`
      INSERT INTO service_versions (
        id, service_id, version, name, description, base_price_minor, currency,
        delivery_min_days, delivery_max_days, included_items
      ) VALUES (${ids.version}, ${ids.service}, 1, 'Lead browser', 'Fixture', 10000, 'USD', 1, 7, '[]'::jsonb)`;
    await client`
      UPDATE service_offerings SET active_version_id = ${ids.version} WHERE id = ${ids.service}`;
    await client`
      INSERT INTO pricing_rule_sets (id, service_version_id, version, evaluator_version, content_hash)
      VALUES (${ids.ruleSet}, ${ids.version}, 1, 'v1', 'lead-browser')`;
    await client`
      INSERT INTO scope_sessions (
        id, ref, service_id, revision, goal, goal_actor, budget_max_minor, budget_actor,
        target_delivery_date, delivery_actor, expires_at, finalized_at
      ) VALUES (
        ${ids.scope}, ${`owner-lead-${ids.scope}`}, ${ids.service}, 3, 'Launch a reviewed website', 'HUMAN',
        30000, 'AGENT', '2026-12-01T00:00:00Z', 'HUMAN', now() + interval '1 day', now()
      )`;
    await client`
      INSERT INTO quotes (id, scope_id, scope_revision, rule_set_id, input_hash, snapshot, total_minor)
      VALUES (${ids.quote}, ${ids.scope}, 3, ${ids.ruleSet}, 'owner-lead', '{"ruleVersion":1,"evaluator":"v1"}'::jsonb, 25000)`;
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
  } finally {
    await client.end({ timeout: 5 });
  }
});

test("owner reviews the complete qualified-lead handoff and ordered activity", async ({ page }) => {
  await page.goto("/owner/login");
  await page.getByLabel("Email").fill(ownerEmailFor(ids.owner));
  await page.getByLabel("Password").fill("owner-test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Services" })).toBeVisible();
  await page.goto("/owner/leads");
  await expect(page.getByRole("link", { name: "Launch a reviewed website" })).toBeVisible();
  await page.getByRole("link", { name: "Launch a reviewed website" }).click();

  await expect(page.getByRole("heading", { name: "Launch a reviewed website" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Contact" })).toBeVisible();
  await expect(page.getByText("buyer@example.test")).toBeVisible();
  await expect(page.getByText("pages: 6 (AGENT)")).toBeVisible();
  await expect(page.getByText("Buyer provides copy (HUMAN)")).toBeVisible();
  await expect(page.getByText(`Immutable quote ID: ${ids.quote}`)).toBeVisible();
  await expect(page.getByText('"ruleVersion": 1')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Booking" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
  const activity = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Activity" }) });
  await expect(activity.getByRole("listitem").nth(0)).toContainText("SCOPE_CREATED");
  await expect(activity.getByRole("listitem").nth(1)).toContainText("SCOPE_UPDATED");
  await expect(activity.getByRole("listitem").nth(2)).toContainText("SCOPE_FINALIZED");
});
