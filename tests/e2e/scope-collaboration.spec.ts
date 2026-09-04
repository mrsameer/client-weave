import { expect, test, type Page, type Request as PlaywrightRequest } from "@playwright/test";

type ScopeReview = {
  ref: string;
  revision: number;
  goal: string;
  goalActor: string;
  goalUpdatedAt: string;
  budgetMaxMinor: number | null;
  budgetActor: string;
  budgetUpdatedAt: string;
  targetDeliveryDate: string | null;
  deliveryActor: string;
  deliveryUpdatedAt: string;
  assumptions: Array<{ value: string; actor: string; updatedAt: string }>;
  answers: Record<
    string,
    { value: number | boolean | string | null; actor: string; updatedAt: string }
  >;
  fields: Array<{ key: string; type: "NUMBER" | "BOOLEAN"; required: boolean }>;
};

async function installScopeRoutes(
  page: Page,
  getCurrent: () => ScopeReview,
  update: (request: PlaywrightRequest) => void
) {
  await page.route("**/api/v1/scopes/current/events", (route) => route.abort());
  await page.route("**/api/v1/scopes/current", (route) => {
    if (route.request().method() === "PATCH") update(route.request());
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(getCurrent()) });
  });
}

test("two clients converge attributed updates without overwriting a dirty local draft", async ({
  browser
}) => {
  let current: ScopeReview = {
    ref: "scope-collaboration",
    revision: 1,
    goal: "Launch a website",
    goalActor: "HUMAN",
    goalUpdatedAt: "2026-09-03T00:00:00.000Z",
    budgetMaxMinor: 500000,
    budgetActor: "HUMAN",
    budgetUpdatedAt: "2026-09-03T00:00:00.000Z",
    targetDeliveryDate: "2026-10-01T00:00:00.000Z",
    deliveryActor: "HUMAN",
    deliveryUpdatedAt: "2026-09-03T00:00:00.000Z",
    assumptions: [],
    answers: {
      team_size: { value: 4, actor: "HUMAN", updatedAt: "2026-09-03T00:00:00.000Z" }
    },
    fields: [{ key: "team_size", type: "NUMBER", required: true }]
  };
  const update = (request: PlaywrightRequest) => {
    const patch = request.postDataJSON() as Partial<{
      goal: string;
      targetDeliveryDate: string | null;
      answers: Record<string, number | boolean | string | null>;
    }>;
    const actor =
      request.headers()["x-clientweave-capability"] === "update_scope" ? "AGENT" : "HUMAN";
    const now = new Date().toISOString();
    current = {
      ...current,
      revision: current.revision + 1,
      ...(patch.goal === undefined
        ? {}
        : { goal: patch.goal, goalActor: actor, goalUpdatedAt: now }),
      ...(patch.targetDeliveryDate === undefined
        ? {}
        : {
            targetDeliveryDate: patch.targetDeliveryDate,
            deliveryActor: actor,
            deliveryUpdatedAt: now
          }),
      ...(patch.answers === undefined
        ? {}
        : {
            answers: {
              ...current.answers,
              ...Object.fromEntries(
                Object.entries(patch.answers).map(([key, value]) => [
                  key,
                  { value, actor, updatedAt: now }
                ])
              )
            }
          })
    };
  };
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const first = await firstContext.newPage();
  const second = await secondContext.newPage();
  await Promise.all([
    installScopeRoutes(first, () => current, update),
    installScopeRoutes(second, () => current, update)
  ]);
  await Promise.all([first.goto("/s/scope-collaboration"), second.goto("/s/scope-collaboration")]);
  await expect(second.getByRole("heading", { name: "Launch a website" })).toBeVisible();

  const startedAt = performance.now();
  await first.getByLabel("Goal").fill("Launch a multilingual website");
  await first.getByRole("button", { name: "Save scope changes" }).click();
  await expect(second.getByRole("heading", { name: "Launch a multilingual website" })).toBeVisible({
    timeout: 2_000
  });
  expect(performance.now() - startedAt).toBeLessThan(2_000);
  await expect(second.getByText("Last set by human").first()).toBeVisible();
  await expect(
    second.getByText("This shared scope was updated elsewhere. The latest values are now shown.")
  ).toBeFocused();

  await second.getByLabel("Target delivery date").fill("2026-10-15");
  await first.evaluate(() =>
    fetch("/api/v1/scopes/current", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-clientweave-capability": "update_scope"
      },
      body: JSON.stringify({ answers: { team_size: 8 } })
    })
  );
  await expect(
    second.locator('div[role="alert"]').filter({ hasText: "This scope changed elsewhere" })
  ).toBeVisible({ timeout: 2_500 });
  await expect(second.getByLabel("Target delivery date")).toHaveValue("2026-10-15");
  await second.getByRole("button", { name: "Use latest shared values" }).click();
  await expect(second.getByLabel("Team Size (required)")).toHaveValue("8");
  await expect(second.getByText("Last set by agent").first()).toBeVisible();

  await Promise.all([firstContext.close(), secondContext.close()]);
});
