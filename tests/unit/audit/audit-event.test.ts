import { describe, expect, it } from "vitest";
import { appendAuditEvent } from "../../../src/modules/audit/application/append-audit-event";

describe("appendAuditEvent", () => {
  it("accepts only the closed actor and outcome catalog", async () => {
    const events: unknown[] = [];
    await appendAuditEvent(
      {
        append: async (event) => {
          events.push(event);
        }
      },
      { actor: "HUMAN", action: "SCOPE_CREATED", outcome: "SUCCEEDED", metadata: {} }
    );
    expect(events).toHaveLength(1);
    await expect(
      appendAuditEvent(
        { append: async () => undefined },
        { actor: "HUMAN", action: "bad action", outcome: "SUCCEEDED", metadata: {} }
      )
    ).rejects.toThrow("closed uppercase");
  });
});
