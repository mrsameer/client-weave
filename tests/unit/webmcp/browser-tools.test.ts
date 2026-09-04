import { describe, expect, it } from "vitest";
import { browserWebMcpTools } from "../../../src/webmcp/browser-tools";
import { capabilityRegistry } from "../../../src/webmcp/registry";

describe("browser WebMCP registration", () => {
  it("exposes exactly the audited six capabilities with executable schemas", () => {
    expect(browserWebMcpTools.map((tool) => tool.name).sort()).toEqual(
      capabilityRegistry.map((tool) => tool.name).sort()
    );
    for (const tool of browserWebMcpTools) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema).toMatchObject({ type: "object", additionalProperties: false });
      expect(tool.execute).toBeTypeOf("function");
    }
    expect(
      browserWebMcpTools.find((tool) => tool.name === "discover_services")?.annotations
    ).toEqual({
      readOnlyHint: true
    });
    expect(
      browserWebMcpTools.find((tool) => tool.name === "finalize_confirmed_scope")?.description
    ).toMatch(/directly confirmed/i);
  });
});
