import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, test } from "@playwright/test";
import { ensureOwnerAuthStub, ownerEmailFor } from "./owner-auth-stub";

const databaseUrl = process.env.TEST_DATABASE_URL;
const workspaceId = randomUUID();
const ownerId = randomUUID();

test.skip(!databaseUrl, "requires TEST_DATABASE_URL and local owner-auth test configuration");

test.beforeAll(async () => {
  await ensureOwnerAuthStub();
  const client = postgres(databaseUrl!, { max: 1, prepare: false });
  try {
    await client`
      INSERT INTO workspaces (id, name, timezone) VALUES (${workspaceId}, 'Owner browser', 'UTC')`;
    await client`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES (${workspaceId}, ${ownerId}, 'OWNER')`;
  } finally {
    await client.end({ timeout: 5 });
  }
});

test("owner signs in and publishes a service from the template editor", async ({ page }) => {
  await page.goto("/owner/login");
  await page.getByLabel("Email").fill(ownerEmailFor(ownerId));
  await page.getByLabel("Password").fill("owner-test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Services" })).toBeVisible();

  const slug = `owner-browser-${workspaceId.slice(0, 8)}`;
  await page.getByLabel("URL slug").fill(slug);
  await page.getByLabel("Service name").fill("<script>invalid</script>");
  await page.getByRole("button", { name: "Publish version" }).click();
  await expect(
    page.getByText("Configuration text must not contain executable markup or code.")
  ).toBeVisible();

  await page.getByLabel("URL slug").fill(slug);
  await page.getByLabel("Service name").fill("Owner browser service");
  const intake = page.getByRole("group", { name: "Intake fields" });
  await intake.getByRole("button", { name: "Add intake field" }).click();
  await intake.getByLabel("Key").fill("pages");
  await intake.getByLabel("Type").selectOption("NUMBER");
  await intake.getByLabel("Required").check();
  const rules = page.getByRole("group", { name: "Pricing rules" });
  for (let index = 0; index < 4; index += 1)
    await rules.getByRole("button", { name: "Add pricing rule" }).click();
  const kinds = ["BASE", "QUANTITY", "ADDON", "CONDITIONAL"] as const;
  for (const [index, kind] of kinds.entries()) {
    await rules.getByLabel("Kind").nth(index).selectOption(kind);
    await rules
      .getByLabel("Fixed minor units")
      .nth(index)
      .fill(String((index + 1) * 100));
    if (kind !== "BASE")
      await rules
        .getByLabel("Field")
        .nth(index - 1)
        .selectOption("pages");
  }
  await page.getByLabel("Constraint kind").selectOption("REQUIRES_FIELD");
  await page.getByRole("button", { name: "Publish version" }).click();
  await expect(page.getByText("Published version 1.")).toBeVisible();
  await page.reload();
  const serviceLink = page.getByRole("link", { name: slug });
  await expect(serviceLink).toBeVisible();
  const serviceHref = await serviceLink.getAttribute("href");
  expect(serviceHref).toBeTruthy();

  await page.goto(serviceHref!);
  await page.getByRole("button", { name: "Publish version" }).click();
  await expect(page.getByText("Published version 2.")).toBeVisible();
  await expect(page.getByText("Version 1")).toBeVisible();

  await page.goto(`/api/v1/services?need=${encodeURIComponent("Owner browser service")}`);
  await expect(page.getByText("Owner browser service")).toBeVisible();

  await page.goto("/owner/availability");
  await page.getByLabel("Starts").fill("2026-12-01T10:00");
  await page.getByLabel("Ends").fill("2026-12-01T10:30");
  await page.getByRole("button", { name: "Add available slot" }).click();
  await page.getByRole("button", { name: "Block slot" }).click();
  await expect(page.getByText("BLOCKED")).toBeVisible();
});

test("anonymous and wrong-workspace users cannot open owner resources", async ({ page }) => {
  await page.goto("/owner/leads");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  const outsiderId = randomUUID();
  await page.getByLabel("Email").fill(ownerEmailFor(outsiderId));
  await page.getByLabel("Password").fill("owner-test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page).toHaveURL(/\/owner\/login$/);
});
