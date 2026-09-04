import { evaluatePricingV1, type PricingInput } from "./evaluator-v1";

export type EvaluatorVersion = "v1";
export function evaluateWithVersion(version: EvaluatorVersion, input: PricingInput) {
  if (version === "v1") return evaluatePricingV1(input);
  throw new Error(`Unsupported evaluator version: ${version}`);
}
