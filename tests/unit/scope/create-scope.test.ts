import { describe, expect, it } from "vitest";
import { createScope } from "../../../src/modules/scope/application/create-scope";
import type { NewScope } from "../../../src/db/repositories/scope-repository";

describe("createScope", () => {
  it("creates a durable 30-day scope and returns the secret only in its continuation URL", async () => {
    let captured: NewScope | undefined;
    const result = await createScope(
      {
        create: async (input) => {
          captured = input;
          return {
            ...input,
            id: "scope",
            revision: 1,
            goalActor: input.actor,
            goalUpdatedAt: new Date("2026-01-01T00:00:00Z"),
            budgetActor: input.actor,
            budgetUpdatedAt: new Date("2026-01-01T00:00:00Z"),
            deliveryActor: input.actor,
            deliveryUpdatedAt: new Date("2026-01-01T00:00:00Z"),
            assumptions: [],
            answers: {},
            fields: []
          };
        }
      },
      {
        serviceId: "service",
        goal: " Website ",
        budgetMaxMinor: null,
        targetDeliveryDate: null,
        assumptions: [],
        answers: {},
        actor: "HUMAN"
      },
      "a sufficiently long pepper used only for test values",
      new Date("2026-01-01T00:00:00Z")
    );
    expect(captured?.expiresAt.toISOString()).toBe("2026-01-31T00:00:00.000Z");
    expect(result.continuationUrl).toContain(`#${result.capability.secret}`);
    expect(result.scope.goal).toBe("Website");
  });
});
