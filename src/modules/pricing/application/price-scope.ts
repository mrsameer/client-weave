import { canonicalHash } from "../domain/canonicalize";
import { evaluatePricingV1, type PricingInput } from "../domain/evaluator-v1";
import type { ScopeIssue } from "@/modules/scope/domain/validate-scope";

export type PriceScopeResult = {
  status: "INCOMPLETE" | "CONFLICTED" | "CURRENT";
  eligible: boolean;
  currency?: string | undefined;
  minimumTotalMinor?: number;
  maximumTotalMinor?: number;
  lineItems: Array<{
    ruleId: string;
    label: string;
    kind: "BASE" | "QUANTITY" | "ADDON" | "CONDITIONAL";
    priority: number;
    amountMinor: number;
  }>;
  assumptions: Array<{
    value: string | number | boolean | string[] | null;
    actor: string;
    updatedAt: string;
  }>;
  issues: ScopeIssue[];
  calculatedAt: string;
  pricingRuleVersion?: number | undefined;
  quote: unknown | null;
  inputHash: string;
  totalMinor?: number;
};

export interface QuoteWriter {
  persist(input: {
    scopeId: string;
    scopeRevision: number;
    ruleSetId: string;
    inputHash: string;
    snapshot: object;
    totalMinor: number;
  }): Promise<unknown>;
  appendPriceAudit?(input: {
    workspaceId: string;
    scopeId: string;
    scopeRevision: number;
    ruleSetId: string;
    inputHash: string;
  }): Promise<void>;
}

export async function priceScope(
  writer: QuoteWriter,
  input: PricingInput & {
    scopeId: string;
    scopeRevision: number;
    ruleSetId: string;
    evaluatorVersion: "v1";
    workspaceId?: string;
    currency?: string;
    pricingRuleVersion?: number;
    issues?: ScopeIssue[];
    assumptions?: PriceScopeResult["assumptions"];
  }
): Promise<PriceScopeResult> {
  const snapshot = {
    basePriceMinor: input.basePriceMinor,
    answers: input.answers,
    selectedAddons: input.selectedAddons ?? [],
    rules: input.rules,
    evaluatorVersion: input.evaluatorVersion
  };
  const inputHash = canonicalHash(snapshot);
  const issues = input.issues ?? [];
  const calculatedAt = new Date().toISOString();
  if (issues.length) {
    const status = issues.some((issue) => issue.severity === "CONFLICT")
      ? "CONFLICTED"
      : "INCOMPLETE";
    return {
      status,
      eligible: false,
      currency: input.currency,
      lineItems: [],
      assumptions: input.assumptions ?? [],
      issues,
      calculatedAt,
      pricingRuleVersion: input.pricingRuleVersion,
      quote: null,
      inputHash
    };
  }
  const calculated = evaluatePricingV1(input);
  const quote = await writer.persist({
    scopeId: input.scopeId,
    scopeRevision: input.scopeRevision,
    ruleSetId: input.ruleSetId,
    inputHash,
    snapshot: { ...snapshot, lineItems: calculated.lineItems },
    totalMinor: calculated.totalMinor
  });
  if (input.workspaceId && writer.appendPriceAudit)
    await writer.appendPriceAudit({
      workspaceId: input.workspaceId,
      scopeId: input.scopeId,
      scopeRevision: input.scopeRevision,
      ruleSetId: input.ruleSetId,
      inputHash
    });
  return {
    status: "CURRENT",
    eligible: true,
    currency: input.currency ?? "USD",
    minimumTotalMinor: calculated.totalMinor,
    maximumTotalMinor: calculated.totalMinor,
    lineItems: calculated.lineItems,
    assumptions: input.assumptions ?? [],
    issues: [],
    calculatedAt,
    pricingRuleVersion: input.pricingRuleVersion,
    quote,
    inputHash,
    totalMinor: calculated.totalMinor
  };
}
