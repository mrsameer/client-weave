import { expect, test } from "@playwright/test";

test("registers all contracted WebMCP tools with the browser model context", async ({ page }) => {
  await page.addInitScript(() => {
    const registered = new Set<string>();
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool: (tool: { name: string }, options?: { signal?: AbortSignal }) => {
          registered.add(tool.name);
          options?.signal?.addEventListener("abort", () => registered.delete(tool.name));
        }
      }
    });
    Object.defineProperty(window, "__registeredWebMcpTools", {
      configurable: true,
      value: () => [...registered]
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
});
