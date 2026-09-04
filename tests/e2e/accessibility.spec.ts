import { expect, test } from "@playwright/test";

function relativeLuminance(rgb: string) {
  const channels = rgb.match(/\d+(?:\.\d+)?/g)?.map(Number);
  if (!channels || channels.length < 3) throw new Error(`Expected an RGB colour, received ${rgb}`);
  const linear = channels.slice(0, 3).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrastRatio(foreground: string, background: string) {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a
  );
  return (lighter! + 0.05) / (darker! + 0.05);
}

test.describe("buyer catalog accessibility baseline", () => {
  test("provides a labeled, keyboard-reachable discovery flow with live feedback", async ({
    page
  }) => {
    await page.goto("/");
    const need = page.getByLabel("What are you trying to achieve?");
    await expect(need).toBeVisible();
    await expect(page.getByRole("heading", { name: "Find the right service" })).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(need).toBeFocused();
    await page.keyboard.type("Launch a marketing website");
    await expect(need).toHaveValue("Launch a marketing website");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Find services" })).toBeFocused();
    await expect(page.getByRole("button", { name: "Find services" })).toHaveCSS(
      "outline-width",
      "3px"
    );
    await page.keyboard.press("Enter");
    await expect(page.locator('[aria-live="polite"]')).toContainText(
      /Searching services|Could not load services/
    );
  });

  test("retains a coherent heading and control hierarchy on a narrow viewport", async ({
    page
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find the right service");
    await expect(page.getByLabel("What are you trying to achieve?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Find services" })).toBeVisible();
  });

  test("renders typed requirements and preserves a dirty draft for collision review", async ({
    page
  }) => {
    let current = {
      ref: "scope-test",
      revision: 1,
      goal: "Launch a website",
      goalActor: "HUMAN",
      goalUpdatedAt: "2026-09-03T00:00:00.000Z",
      budgetMaxMinor: 500000,
      budgetActor: "HUMAN",
      budgetUpdatedAt: "2026-09-03T00:00:00.000Z",
      targetDeliveryDate: "2026-10-01T00:00:00.000Z",
      deliveryActor: "AGENT",
      deliveryUpdatedAt: "2026-09-03T00:00:00.000Z",
      assumptions: [
        {
          value: "Copy is supplied by the buyer.",
          actor: "AGENT",
          updatedAt: "2026-09-03T00:00:00.000Z"
        }
      ],
      answers: {
        team_size: {
          value: 4,
          actor: "AGENT",
          updatedAt: "2026-09-03T00:00:00.000Z"
        },
        hosting: {
          value: true,
          actor: "HUMAN",
          updatedAt: "2026-09-03T00:00:00.000Z"
        }
      },
      fields: [
        { key: "team_size", type: "NUMBER", required: true, min: 1, max: 20 },
        { key: "hosting", type: "BOOLEAN", required: false }
      ]
    };
    await page.route("**/api/v1/scopes/current/events", (route) => route.abort());
    await page.route("**/api/v1/scopes/current/quotes", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          status: "INCOMPLETE",
          eligible: false,
          lineItems: [],
          assumptions: [],
          issues: [
            {
              code: "REQUIRED",
              field: "team_size",
              message: "Team size is required before pricing.",
              severity: "MISSING"
            }
          ],
          calculatedAt: "2026-09-03T00:00:00.000Z"
        })
      })
    );
    await page.route("**/api/v1/scopes/current", (route) => {
      if (route.request().method() === "PATCH")
        return route.fulfill({
          status: 412,
          contentType: "application/json",
          body: JSON.stringify({ detail: "The scope changed while saving." })
        });
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(current) });
    });

    await page.goto("/s/scope-test");
    await expect(page.getByRole("heading", { name: "Launch a website" })).toBeVisible();
    await expect(page.getByLabel("Team Size (required)")).toHaveValue("4");
    await expect(page.getByText("Last set by agent").first()).toBeVisible();

    await page.getByLabel("Goal").fill("Keep my local goal");
    current = {
      ...current,
      revision: 2,
      goal: "Agent revised the goal",
      goalActor: "AGENT",
      goalUpdatedAt: "2026-09-03T00:00:01.000Z"
    };
    await expect(
      page.locator('div[role="alert"]').filter({ hasText: "This scope changed elsewhere" })
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByText("This shared scope was updated elsewhere. The latest values are now shown.")
    ).toBeFocused();
    await expect(page.getByLabel("Goal")).toHaveValue("Keep my local goal");
    await page.getByRole("button", { name: "Use latest shared values" }).click();
    await expect(page.getByLabel("Goal")).toHaveValue("Agent revised the goal");
    await page.getByRole("button", { name: "Save scope changes" }).click();
    await expect(
      page.getByRole("alert").filter({
        hasText: "This scope changed elsewhere. Review the latest values before saving again."
      })
    ).toBeFocused();
    await page.getByRole("button", { name: "Calculate quote" }).click();
    await expect(page.getByRole("heading", { name: "Complete the scope" })).toBeVisible();
    await expect(page.getByText("Team size is required before pricing.")).toBeVisible();

    const colours = await page.locator("body").evaluate((element) => {
      const styles = getComputedStyle(element);
      return { foreground: styles.color, background: styles.backgroundColor };
    });
    expect(contrastRatio(colours.foreground, colours.background)).toBeGreaterThanOrEqual(4.5);
  });
});
