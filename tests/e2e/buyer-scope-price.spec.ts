import { expect, test } from "@playwright/test";

test("buyer can discover, reload a draft, correct quote issues, and obtain a current quote", async ({
  page
}) => {
  let scope = {
    ref: "buyer-scope",
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
        ref: "buyer-scope",
        continuationUrl: "/s/buyer-scope#one-time-secret"
      })
    })
  );
  await page.route("**/api/v1/scopes/exchange", (route) => route.fulfill({ status: 204 }));
  await page.route("**/api/v1/scopes/current/events", (route) => route.abort());
  await page.route("**/api/v1/scopes/current/quotes", (route) => {
    const response =
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
              pricingRuleVersion: 1
            };
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(response) });
  });
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
          : {
              budgetMaxMinor: patch.budgetMaxMinor,
              budgetActor: "HUMAN",
              budgetUpdatedAt: new Date().toISOString()
            }),
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

  await page.goto("/");
  await page.getByLabel("What are you trying to achieve?").fill("Launch a website");
  await page.getByRole("button", { name: "Find services" }).click();
  await expect(
    page.getByText("Budget is below the starting range; reduce scope or raise budget.")
  ).toBeVisible();
  await page.getByRole("link", { name: "View service" }).click();
  await page.getByLabel("What should this service achieve?").fill("Launch a website");
  await page.getByRole("button", { name: "Start a draft scope" }).click();
  await expect(page.getByRole("heading", { name: "Launch a website" })).toBeVisible();

  await page.getByRole("button", { name: "Calculate quote" }).click();
  await expect(page.getByRole("heading", { name: "Complete the scope" })).toBeVisible();
  await expect(page.getByText("Pages is required.")).toBeVisible();
  await page.getByLabel("Pages (required)").fill("6");
  await page.getByRole("button", { name: "Save scope changes" }).click();
  quoteState = "CONFLICTED";
  await page.getByRole("button", { name: "Calculate quote" }).click();
  await expect(page.getByRole("heading", { name: "Resolve scope conflicts" })).toBeVisible();
  await expect(page.getByText("Budget is below the selected website scope.")).toBeVisible();
  await page.getByLabel("Maximum budget (USD)").fill("2500");
  await page.getByRole("button", { name: "Save scope changes" }).click();
  quoteState = "CURRENT";
  await page.getByRole("button", { name: "Calculate quote" }).click();
  await expect(page.getByRole("heading", { name: "Current planning range" })).toBeVisible();
  await expect(page.getByText("$2,000.00", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Launch a website" })).toBeVisible();
  await expect(page.getByLabel("Pages (required)")).toHaveValue("6");
});
