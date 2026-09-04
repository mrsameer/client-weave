import { describe, expect, it } from "vitest";
import { normalizeScope } from "../../../src/modules/scope/domain/normalize-scope";
import { validateScope } from "../../../src/modules/scope/domain/validate-scope";

describe("scope validation", () => {
  it("normalizes assumptions and reports deterministic actionable issues", () => {
    const scope = normalizeScope({
      goal: "  Website  ",
      budgetMaxMinor: null,
      targetDeliveryDate: null,
      assumptions: ["  Content supplied ", "Content supplied"],
      answers: { pages: 0, plan: "bad" }
    });
    expect(scope.assumptions).toEqual(["Content supplied"]);
    expect(
      validateScope(scope, [
        { key: "brand", type: "TEXT", required: true },
        { key: "pages", type: "NUMBER", required: true, min: 1 },
        { key: "plan", type: "SELECT", required: true, choices: ["starter"] }
      ])
    ).toMatchObject([
      { code: "REQUIRED", field: "brand" },
      { code: "OUT_OF_RANGE", field: "pages" },
      { code: "UNSUPPORTED_OPTION", field: "plan" }
    ]);
  });

  it("bounds assumptions, preserves hostile prose as data, and enforces typed answers", () => {
    expect(() =>
      normalizeScope({
        goal: "x",
        budgetMaxMinor: null,
        targetDeliveryDate: null,
        assumptions: ["x".repeat(501)],
        answers: {}
      })
    ).toThrow("500");
    const scope = normalizeScope({
      goal: "  <script>not executable</script>  ",
      budgetMaxMinor: null,
      targetDeliveryDate: null,
      assumptions: ["  full-width Ａ  "],
      answers: { seats: "three", extras: ["valid", "unknown"] }
    });
    expect(scope.goal).toBe("<script>not executable</script>");
    expect(scope.assumptions).toEqual(["full-width A"]);
    expect(
      validateScope(scope, [
        { key: "seats", type: "NUMBER", required: true, min: 1 },
        { key: "extras", type: "MULTI_SELECT", required: false, choices: ["valid"] }
      ])
    ).toMatchObject([
      { code: "UNSUPPORTED_OPTION", field: "extras" },
      { code: "INVALID_TYPE", field: "seats" }
    ]);
  });

  it("orders missing values before conflicts regardless of field declaration order", () => {
    const scope = normalizeScope({
      goal: "Goal",
      budgetMaxMinor: null,
      targetDeliveryDate: null,
      assumptions: [],
      answers: { b: "wrong", c: true }
    });
    const issues = validateScope(
      scope,
      [
        { key: "c", type: "TEXT", required: true },
        { key: "a", type: "TEXT", required: true },
        { key: "b", type: "NUMBER", required: true }
      ],
      [{ field: "c", incompatibleWith: { field: "b", equals: "wrong" }, message: "Conflict" }]
    );
    expect(issues.map((issue) => `${issue.severity}:${issue.field}:${issue.code}`)).toEqual([
      "MISSING:a:REQUIRED",
      "CONFLICT:b:INVALID_TYPE",
      "CONFLICT:c:INCOMPATIBLE_OPTIONS",
      "CONFLICT:c:INVALID_TYPE"
    ]);
  });
});
