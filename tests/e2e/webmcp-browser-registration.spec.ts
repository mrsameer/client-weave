import { expect, test } from "@playwright/test";

test("registers all contracted WebMCP tools with the browser model context", async ({ page }) => {
  if (!process.env.LIVE_WEBMCP_URL)
    await page.route("**/api/v1/services?*", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ services: [{ slug: "launch-website", name: "Launch Website" }] })
      })
    );
  await page.addInitScript(() => {
    type Tool = { name: string; execute: (input: Record<string, unknown>) => Promise<unknown> };
    const registered = new Map<string, Tool>();
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool: (tool: Tool, options?: { signal?: AbortSignal }) => {
          registered.set(tool.name, tool);
          options?.signal?.addEventListener("abort", () => registered.delete(tool.name));
        }
      }
    });
    Object.defineProperty(window, "__registeredWebMcpTools", {
      configurable: true,
      value: () => [...registered.keys()]
    });
    Object.defineProperty(window, "__callWebMcpTool", {
      configurable: true,
      value: (name: string, input: Record<string, unknown>) => registered.get(name)?.execute(input)
    });
  });
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as typeof window & { __registeredWebMcpTools: () => string[] })
          .__registeredWebMcpTools()
          .sort()
      )
    )
    .toEqual([
      "create_scope",
      "discover_services",
      "finalize_confirmed_scope",
      "find_consultation_slots",
      "price_scope",
      "update_scope"
    ]);
  const discovery = await page.evaluate(() =>
    (
      window as typeof window & {
        __callWebMcpTool: (name: string, input: Record<string, unknown>) => Promise<unknown>;
      }
    ).__callWebMcpTool("discover_services", { need: "website" })
  );
  expect((discovery as { services: unknown[] }).services).toEqual(
    expect.arrayContaining([expect.objectContaining({ slug: "launch-website" })])
  );
});
