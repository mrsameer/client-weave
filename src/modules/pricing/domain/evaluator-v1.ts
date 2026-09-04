import { roundHalfAwayFromZero } from "./canonicalize";

export type PricingRule = {
  id: string;
  label: string;
  kind: "QUANTITY" | "ADDON" | "CONDITIONAL";
  priority: number;
  amountMinor?: number;
  percentBasisPoints?: number;
  field?: string;
  equals?: string | number | boolean;
  quantityField?: string;
};

export type PricingInput = {
  basePriceMinor: number;
  answers: Record<string, unknown>;
  selectedAddons?: string[];
  rules: PricingRule[];
};

export type EvaluatedLineItem = {
  ruleId: string;
  label: string;
  kind: "BASE" | PricingRule["kind"];
  priority: number;
  amountMinor: number;
};

export function evaluatePricingV1(input: PricingInput): {
  totalMinor: number;
  lineItems: EvaluatedLineItem[];
} {
  if (!Number.isSafeInteger(input.basePriceMinor) || input.basePriceMinor < 0)
    throw new TypeError("Invalid base price");
  let runningTotal = input.basePriceMinor;
  const lineItems: EvaluatedLineItem[] = [
    { ruleId: "base", label: "Base service", kind: "BASE", priority: 0, amountMinor: runningTotal }
  ];

  for (const rule of [...input.rules].sort(
    (a, b) => a.priority - b.priority || a.id.localeCompare(b.id)
  )) {
    let applies = true;
    if (rule.kind === "ADDON") applies = input.selectedAddons?.includes(rule.id) ?? false;
    if (rule.kind === "CONDITIONAL")
      applies = rule.field !== undefined && input.answers[rule.field] === rule.equals;
    if (!applies) continue;
    let amount = rule.amountMinor ?? 0;
    if (rule.kind === "QUANTITY") {
      const quantity = Number(input.answers[rule.quantityField ?? ""] ?? 0);
      if (!Number.isInteger(quantity) || quantity < 0)
        throw new TypeError(`Invalid quantity for ${rule.id}`);
      amount *= quantity;
    }
    if (rule.percentBasisPoints !== undefined)
      amount += roundHalfAwayFromZero(runningTotal * rule.percentBasisPoints, 10_000);
    if (!Number.isSafeInteger(amount)) throw new RangeError("Price exceeds safe integer range");
    runningTotal += amount;
    lineItems.push({
      ruleId: rule.id,
      label: rule.label,
      kind: rule.kind,
      priority: rule.priority,
      amountMinor: amount
    });
  }
  return { totalMinor: runningTotal, lineItems };
}
