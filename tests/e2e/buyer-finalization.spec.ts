import { expect, test } from "@playwright/test";

test("buyer reviews, directly confirms, books, and safely retries a final action", async ({
  page
}) => {
  const slotId = "00000000-0000-4000-8000-000000000101";
  const scope = {
    ref: "finalization-scope",
    revision: 1,
    goal: "Launch a website",
    goalActor: "HUMAN",
    goalUpdatedAt: "2026-09-03T00:00:00.000Z",
    budgetMaxMinor: 250000,
    budgetActor: "HUMAN",
    budgetUpdatedAt: "2026-09-03T00:00:00.000Z",
    targetDeliveryDate: "2026-10-01T00:00:00.000Z",
    deliveryActor: "HUMAN",
    deliveryUpdatedAt: "2026-09-03T00:00:00.000Z",
    assumptions: [],
    answers: {},
    fields: []
  };
  let reviewCount = 0;
  let confirmationCount = 0;
  const idempotencyKeys: string[] = [];
  await page.route("**/api/v1/scopes/current/events", (route) => route.abort());
  await page.route("**/api/v1/scopes/current", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(scope) })
  );
  await page.route("**/api/v1/scopes/current/quotes", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        status: "CURRENT",
        eligible: true,
        currency: "USD",
        minimumTotalMinor: 200000,
        maximumTotalMinor: 200000,
        lineItems: [{ label: "Base service", amountMinor: 200000 }],
        assumptions: [],
        issues: [],
        calculatedAt: "2026-09-03T00:00:00.000Z"
      })
    })
  );
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
  await page.route("**/api/v1/scopes/current/final-summary", (route) => {
    reviewCount += 1;
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        summary: {
          hash: `${reviewCount}`.repeat(64),
          nonce: "00000000-0000-4000-8000-000000000102",
          expiresAt: "2026-12-01T00:00:00.000Z",
          scopeRevision: 1,
          quoteTotalMinor: 200000,
          action: "SUBMIT_LEAD_AND_BOOK",
          slotId,
          quoteId: "00000000-0000-4000-8000-000000000103",
          contact: { email: "buyer@example.test" },
          retentionNotice: "Lead information is retained according to the workspace policy.",
          scopeSnapshot: { goal: "Launch a website" },
          quoteSnapshot: { lineItems: [{ label: "Base service", amountMinor: 200000 }] },
          serviceConstraints: []
        }
      })
    });
  });
  await page.route("**/api/v1/scopes/current/human-confirmations", (route) => {
    confirmationCount += 1;
    return route.fulfill(
      confirmationCount === 1
        ? {
            status: 409,
            contentType: "application/json",
            body: JSON.stringify({ detail: "Review changed. Confirm the current summary again." })
          }
        : {
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({ id: "confirmation" })
          }
    );
  });
  await page.route("**/api/v1/scopes/current/finalizations", (route) => {
    idempotencyKeys.push(route.request().headers()["idempotency-key"]!);
    return route.fulfill({
      status: idempotencyKeys.length === 1 ? 201 : 200,
      contentType: "application/json",
      body: JSON.stringify({ leadId: "lead-1", bookingId: "booking-1" })
    });
  });

  await page.goto("/s/finalization-scope");
  await page.getByRole("button", { name: "Calculate quote" }).click();
  await page.getByRole("button", { name: "Refresh slots" }).click();
  await expect(page.getByText("Choose a time; this does not reserve it.")).toBeVisible();
  await page.getByRole("button", { name: /Oct 1, 2026/ }).click();
  await page.getByLabel("Email").fill("buyer@example.test");
  await page.getByRole("button", { name: "Review final action" }).click();
  await expect(page.getByRole("heading", { name: "Final review" })).toBeVisible();
  await page.getByRole("button", { name: "I confirm this exact action" }).click();
  await expect(page.getByText("Review changed. Confirm the current summary again.")).toBeVisible();

  await page.getByRole("button", { name: "Review final action" }).click();
  await page.getByRole("button", { name: "I confirm this exact action" }).click();
  await expect(page.getByRole("button", { name: "Submit confirmed action" })).toBeVisible();
  await page.getByRole("button", { name: "Submit confirmed action" }).click();
  await expect(page.getByText("Your consultation has been booked.")).toBeVisible();
  await page.getByRole("button", { name: "Submit confirmed action" }).click();
  expect(idempotencyKeys).toHaveLength(2);
  expect(idempotencyKeys[0]).toBe(idempotencyKeys[1]);
});
