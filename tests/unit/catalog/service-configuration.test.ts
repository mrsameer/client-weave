import { describe, expect, it } from "vitest";
import {
  configurationConstraintSchema,
  configurationRuleSchema,
  validateServiceConfiguration
} from "../../../src/modules/catalog/domain/service-configuration";

describe("service configuration", () => {
  it("rejects executable-like incomplete configuration graphs", () => {
    const issues = validateServiceConfiguration({
      name: "",
      description: "",
      basePriceMinor: -1,
      deliveryMinDays: 3,
      deliveryMaxDays: 2,
      includedItems: [],
      fields: [{ key: "plan", type: "SELECT", required: true }],
      rules: [{ id: "rule", kind: "CONDITIONAL", priority: 1, label: "Rule", field: "missing" }],
      activeServiceCount: 11
    });
    expect(issues.length).toBeGreaterThan(5);
  });
});

describe("typed service configuration", () => {
  const valid = () => ({
    name: "Launch plan",
    description: "A bounded, plain-language service description.",
    basePriceMinor: 10_000,
    deliveryMinDays: 3,
    deliveryMaxDays: 10,
    includedItems: ["Discovery"],
    fields: [{ key: "tier", type: "SELECT" as const, required: true, choices: ["standard"] }],
    rules: [
      {
        id: "tier_price",
        kind: "CONDITIONAL" as const,
        priority: 10,
        label: "Tier price",
        field: "tier",
        amountMinor: 5_000
      }
    ],
    constraints: [{ kind: "REQUIRES_FIELD" as const, field: "tier" }],
    activeServiceCount: 1
  });

  it("accepts a complete graph with typed operands", () => {
    expect(validateServiceConfiguration(valid())).toEqual([]);
    expect(() => configurationRuleSchema.parse(valid().rules[0])).not.toThrow();
  });

  it("rejects unknown and executable configuration content", () => {
    const graph = valid();
    graph.rules[0]!.field = "unknown";
    graph.constraints = [{ kind: "REQUIRES_FIELD", field: "unknown" }];
    graph.description = "<script>do not execute</script>";
    expect(validateServiceConfiguration(graph).map((issue) => issue.field)).toContain(
      "constraints"
    );
    expect(validateServiceConfiguration(graph).map((issue) => issue.field)).toContain(
      "description"
    );
  });

  it("only accepts closed, typed constraint operands", () => {
    expect(() =>
      configurationConstraintSchema.parse({ kind: "MAX_DELIVERY_DAYS", days: 14 })
    ).not.toThrow();
    expect(() =>
      configurationConstraintSchema.parse({ kind: "MAX_DELIVERY_DAYS", days: "14" })
    ).toThrow();
    expect(() =>
      configurationConstraintSchema.parse({ kind: "SCRIPT", code: "return true" })
    ).toThrow();
  });
});
