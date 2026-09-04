import { canonicalHash } from "../domain/canonicalize";
import { evaluateWithVersion, type EvaluatorVersion } from "../domain/evaluator-registry";
import type { PricingInput } from "../domain/evaluator-v1";

export function replayQuote(
  snapshot: PricingInput & { evaluatorVersion: EvaluatorVersion; inputHash: string }
) {
  const input = {
    basePriceMinor: snapshot.basePriceMinor,
    answers: snapshot.answers,
    selectedAddons: snapshot.selectedAddons ?? [],
    rules: snapshot.rules
  };
  const hash = canonicalHash({ ...input, evaluatorVersion: snapshot.evaluatorVersion });
  if (hash !== snapshot.inputHash)
    throw new Error("Quote input snapshot hash does not match its retained content");
  return evaluateWithVersion(snapshot.evaluatorVersion, input);
}
