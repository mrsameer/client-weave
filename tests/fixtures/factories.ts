import type { PricingRule } from "../../src/modules/pricing/domain/evaluator-v1";

let sequence = 0;
export function resetFactorySequence() {
  sequence = 0;
}
export function entityId(prefix = "entity") {
  sequence += 1;
  return `${prefix}-${String(sequence).padStart(4, "0")}`;
}
export function fixedClock(iso = "2026-01-01T12:00:00.000Z") {
  const now = new Date(iso);
  return { now: () => new Date(now) };
}
export function pricingRule(overrides: Partial<PricingRule> = {}): PricingRule {
  return {
    id: entityId("rule"),
    label: "Adjustment",
    kind: "ADDON",
    priority: sequence,
    amountMinor: 100,
    ...overrides
  };
}
export function scopeFixture(
  overrides: Partial<{
    goal: string;
    budgetMaxMinor: number | null;
    answers: Record<string, unknown>;
  }> = {}
) {
  return {
    id: entityId("scope"),
    revision: 1,
    goal: "Launch a service website",
    budgetMaxMinor: null,
    answers: {},
    ...overrides
  };
}
export function authFixture(
  overrides: Partial<{ scopeId: string; expiresAt: Date; revokedAt: Date | null }> = {}
) {
  return {
    scopeId: entityId("scope"),
    expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    revokedAt: null,
    ...overrides
  };
}
