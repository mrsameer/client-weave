import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { ensureOwnerAuthStub, ownerEmailFor } from "./owner-auth-stub";

const databaseUrl = process.env.TEST_DATABASE_URL;

test("buyer completes one uninterrupted discovery-to-confirmed-booking journey", async ({
  page
}) => {
  const buyerJourneyStartedAt = performance.now();
  const slotId = randomUUID();
  const ownerHandoff = databaseUrl
    ? {
        workspace: randomUUID(),
        owner: randomUUID(),
        service: randomUUID(),
        version: randomUUID(),
        ruleSet: randomUUID(),
        scope: randomUUID(),
        quote: randomUUID(),
        lead: randomUUID()
      }
    : null;
  const databaseClient = databaseUrl ? postgres(databaseUrl, { max: 1, prepare: false }) : null;
  if (ownerHandoff && databaseClient) {
    await ensureOwnerAuthStub();
    await databaseClient`
      INSERT INTO workspaces (id, name, timezone)
      VALUES (${ownerHandoff.workspace}, 'Ordinary journey owner handoff', 'UTC')`;
    await databaseClient`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES (${ownerHandoff.workspace}, ${ownerHandoff.owner}, 'OWNER')`;
    await databaseClient`
      INSERT INTO service_offerings (id, workspace_id, slug, active)
      VALUES (${ownerHandoff.service}, ${ownerHandoff.workspace}, 'ordinary-journey-owner', true)`;
    await databaseClient`
      INSERT INTO service_versions (
        id, service_id, version, name, description, base_price_minor, currency,
        delivery_min_days, delivery_max_days, included_items
      ) VALUES (
        ${ownerHandoff.version}, ${ownerHandoff.service}, 1, 'Website launch', 'Journey fixture',
        200000, 'USD', 14, 28, '[]'::jsonb
      )`;
    await databaseClient`
      UPDATE service_offerings SET active_version_id = ${ownerHandoff.version}
      WHERE id = ${ownerHandoff.service}`;
    await databaseClient`
      INSERT INTO pricing_rule_sets (id, service_version_id, version, evaluator_version, content_hash)
      VALUES (${ownerHandoff.ruleSet}, ${ownerHandoff.version}, 1, 'v1', 'ordinary-journey')`;
    await databaseClient`
      INSERT INTO scope_sessions (
        id, ref, service_id, revision, goal, goal_actor, budget_max_minor, budget_actor,
        target_delivery_date, delivery_actor, expires_at, finalized_at
      ) VALUES (
        ${ownerHandoff.scope}, ${`ordinary-owner-${ownerHandoff.scope}`}, ${ownerHandoff.service}, 3, 'Launch a website',
        'HUMAN', 250000, 'HUMAN', '2026-10-01T00:00:00Z', 'HUMAN',
        now() + interval '1 day', now()
      )`;
    await databaseClient`
      INSERT INTO quotes (id, scope_id, scope_revision, rule_set_id, input_hash, snapshot, total_minor)
      VALUES (
        ${ownerHandoff.quote}, ${ownerHandoff.scope}, 3, ${ownerHandoff.ruleSet},
        'ordinary-journey', '{"ruleVersion":1}'::jsonb, 200000
      )`;
    await databaseClient`
      INSERT INTO availability_slots (id, workspace_id, starts_at, ends_at, status)
      VALUES (
        ${slotId}, ${ownerHandoff.workspace}, '2026-10-01T14:00:00Z',
        '2026-10-01T14:30:00Z', 'AVAILABLE'
      )`;
  }
  let scope = {
    ref: "ordinary-journey",
    revision: 1,
    goal: "Launch a website",
    goalActor: "HUMAN",
    goalUpdatedAt: "2026-09-03T00:00:00.000Z",
    budgetMaxMinor: 150000,
    budgetActor: "HUMAN",
    budgetUpdatedAt: "2026-09-03T00:00:00.000Z",
    targetDeliveryDate: "2026-10-01T00:00:00.000Z",
    deliveryActor: "HUMAN",
    deliveryUpdatedAt: "2026-09-03T00:00:00.000Z",
    assumptions: [],
    answers: {},
    fields: [{ key: "pages", type: "NUMBER", required: true, min: 1, max: 20 }]
  };
  let quoteState: "INCOMPLETE" | "CONFLICTED" | "CURRENT" = "INCOMPLETE";
  let finalizations = 0;
  const idempotencyKeys: string[] = [];

  await page.route("**/api/v1/scopes/current/events", (route) => route.abort());
  await page.route("**/api/v1/services?*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        services: [
          {
            slug: "website-launch",
            name: "Website launch",
            description: "A launch-ready marketing site.",
            basePriceMinor: 200000,
            currency: "USD",
            deliveryMinDays: 14,
            deliveryMaxDays: 28,
            includedItems: ["Design", "Build"],
            fitReasons: ["The goal matches website launch."],
            conflicts: ["Budget is below the starting range; reduce scope or raise budget."]
          }
        ]
      })
    })
  );
  await page.route("**/api/v1/services/website-launch", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        slug: "website-launch",
        name: "Website launch",
        description: "A launch-ready marketing site.",
        basePriceMinor: 200000,
        currency: "USD",
        deliveryMinDays: 14,
        deliveryMaxDays: 28,
        includedItems: ["Design", "Build"]
      })
    })
  );
  await page.route("**/api/v1/scopes", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ref: scope.ref,
        continuationUrl: "/s/ordinary-journey#one-time-secret"
      })
    })
  );
  await page.route("**/api/v1/scopes/exchange", (route) => route.fulfill({ status: 204 }));
  await page.route("**/api/v1/scopes/current", (route) => {
    if (route.request().method() === "PATCH") {
      const patch = route.request().postDataJSON() as {
        answers?: { pages?: number };
        budgetMaxMinor?: number;
      };
      scope = {
        ...scope,
        revision: scope.revision + 1,
        ...(patch.budgetMaxMinor === undefined
          ? {}
          : { budgetMaxMinor: patch.budgetMaxMinor, budgetUpdatedAt: new Date().toISOString() }),
        ...(patch.answers?.pages === undefined
          ? {}
          : {
              answers: {
                pages: {
                  value: patch.answers.pages,
                  actor: "HUMAN",
                  updatedAt: new Date().toISOString()
                }
              }
            })
      };
    }
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(scope) });
  });
  await page.route("**/api/v1/scopes/current/quotes", (route) => {
    const result =
      quoteState === "INCOMPLETE"
        ? {
            status: "INCOMPLETE",
            eligible: false,
            lineItems: [],
            assumptions: [],
            issues: [
              {
                code: "REQUIRED",
                field: "pages",
                message: "Pages is required.",
                severity: "MISSING"
              }
            ],
            calculatedAt: "2026-09-03T00:00:00.000Z"
          }
        : quoteState === "CONFLICTED"
          ? {
              status: "CONFLICTED",
              eligible: false,
              lineItems: [],
              assumptions: [],
              issues: [
                {
                  code: "OVER_BUDGET",
                  field: "budgetMaxMinor",
                  message: "Budget is below the selected website scope.",
                  severity: "CONFLICT"
                }
              ],
              calculatedAt: "2026-09-03T00:00:01.000Z"
            }
          : {
              status: "CURRENT",
              eligible: true,
              currency: "USD",
              minimumTotalMinor: 200000,
              maximumTotalMinor: 200000,
              lineItems: [{ label: "Base service", amountMinor: 200000 }],
              assumptions: [],
              issues: [],
              calculatedAt: "2026-09-03T00:00:02.000Z",
              pricingRuleVersion: 2
            };
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(result) });
  });
  await page.route("**/api/v1/scopes/current/availability", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        timezone: "America/New_York",
        slots: [
          { id: slotId, startsAt: "2026-10-01T14:00:00.000Z", endsAt: "2026-10-01T14:30:00.000Z" }
        ]
      })
    })
  );
  await page.route("**/api/v1/scopes/current/final-summary", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        summary: {
          hash: "a".repeat(64),
          nonce: "00000000-0000-4000-8000-000000000202",
          expiresAt: "2026-12-01T00:00:00.000Z",
          scopeRevision: scope.revision,
          quoteTotalMinor: 200000,
          action: "SUBMIT_LEAD_AND_BOOK",
          slotId,
          quoteId: "00000000-0000-4000-8000-000000000203",
          contact: { email: "buyer@example.test" },
          retentionNotice: "Lead information is retained according to the workspace policy.",
          scopeSnapshot: { goal: scope.goal },
          quoteSnapshot: { lineItems: [{ label: "Base service", amountMinor: 200000 }] },
          serviceConstraints: []
        }
      })
    })
  );
  await page.route("**/api/v1/scopes/current/human-confirmations", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: "confirmation" })
    })
  );
  await page.route("**/api/v1/scopes/current/finalizations", async (route) => {
    finalizations += 1;
    idempotencyKeys.push(route.request().headers()["idempotency-key"]!);
    if (finalizations === 1 && ownerHandoff && databaseClient) {
      await databaseClient`
        INSERT INTO qualified_leads (id, scope_id, quote_id, contact)
        VALUES (
          ${ownerHandoff.lead}, ${ownerHandoff.scope}, ${ownerHandoff.quote},
          '{"email":"buyer@example.test"}'::jsonb
        )`;
      await databaseClient`
        INSERT INTO bookings (scope_id, slot_id, lead_id)
        VALUES (${ownerHandoff.scope}, ${slotId}, ${ownerHandoff.lead})`;
    }
    return route.fulfill({
      status: finalizations === 1 ? 201 : 200,
      contentType: "application/json",
      body: JSON.stringify({
        leadId: ownerHandoff?.lead ?? "lead-journey",
        bookingId: "booking-journey"
      })
    });
  });

  await page.goto("/");
  await page.getByLabel("What are you trying to achieve?").fill(scope.goal);
  await page.getByRole("button", { name: "Find services" }).click();
  await page.getByRole("link", { name: "View service" }).click();
  await page.getByLabel("What should this service achieve?").fill(scope.goal);
  await page.getByRole("button", { name: "Start a draft scope" }).click();
  await page.getByRole("button", { name: "Calculate quote" }).click();
  await expect(page.getByText("Pages is required.")).toBeVisible();
  await page.getByLabel("Pages (required)").fill("6");
  await page.getByRole("button", { name: "Save scope changes" }).click();
  quoteState = "CONFLICTED";
  await page.getByRole("button", { name: "Calculate quote" }).click();
  await expect(page.getByText("Budget is below the selected website scope.")).toBeVisible();
  await page.getByLabel("Maximum budget (USD)").fill("2500");
  await page.getByRole("button", { name: "Save scope changes" }).click();
  quoteState = "CURRENT";
  await page.getByRole("button", { name: "Calculate quote" }).click();
  await expect(page.getByRole("heading", { name: "Current planning range" })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Pages (required)")).toHaveValue("6");
  await page.getByRole("button", { name: "Calculate quote" }).click();
  await expect(page.getByRole("heading", { name: "Current planning range" })).toBeVisible();
  await page.getByRole("button", { name: "Refresh slots" }).click();
  await page.getByRole("button", { name: /Oct 1, 2026/ }).click();
  await page.getByLabel("Email").fill("buyer@example.test");
  await page.getByRole("button", { name: "Review final action" }).click();
  await page.getByRole("button", { name: "I confirm this exact action" }).click();
  await page.getByRole("button", { name: "Submit confirmed action" }).click();
  await expect(page.getByText("Your consultation has been booked.")).toBeVisible();
  await page.getByRole("button", { name: "Submit confirmed action" }).click();
  expect(finalizations).toBe(2);
  expect(idempotencyKeys[0]).toBe(idempotencyKeys[1]);
  if (ownerHandoff && databaseClient) {
    await page.goto("/owner/login");
    await page.getByLabel("Email").fill(ownerEmailFor(ownerHandoff.owner));
    await page.getByLabel("Password").fill("owner-test-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Services" })).toBeVisible();
    await page.goto("/owner/leads");
    await page.getByRole("link", { name: "Launch a website" }).click();
    await expect(page.getByRole("heading", { name: "Launch a website" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Contact" })).toBeVisible();
    await expect(page.getByText("buyer@example.test")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Booking" })).toBeVisible();
    await databaseClient.end({ timeout: 5 });
  }
  const buyerJourneyMilliseconds = performance.now() - buyerJourneyStartedAt;
  expect(buyerJourneyMilliseconds).toBeLessThan(180_000);
  if (process.env.PERFORMANCE_PROFILE)
    console.info(
      JSON.stringify({
        profile: process.env.PERFORMANCE_PROFILE,
        environment: "ordinary-interface-browser",
        monotonicClock: "performance.now",
        buyerCompletions: 1,
        completedWithinThreeMinutes: 1,
        buyerJourneyMilliseconds
      })
    );
});
