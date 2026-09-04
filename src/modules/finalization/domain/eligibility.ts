import type { FinalSummary, FinalSummaryInput } from "./final-summary";
import { confirmationMatches } from "./final-summary";

export type FinalizationEligibility = {
  eligible: boolean;
  code?: "QUOTE_STALE" | "CONFIRMATION_REQUIRED" | "CONFIRMATION_STALE" | "SLOT_REQUIRED";
};

export function assessFinalization(input: {
  quoteCurrent: boolean;
  summary: FinalSummaryInput;
  confirmation: FinalSummary | null;
  now?: Date;
}): FinalizationEligibility {
  if (!input.quoteCurrent) return { eligible: false, code: "QUOTE_STALE" };
  if (input.summary.action === "SUBMIT_LEAD_AND_BOOK" && !input.summary.slotId)
    return { eligible: false, code: "SLOT_REQUIRED" };
  if (!input.confirmation) return { eligible: false, code: "CONFIRMATION_REQUIRED" };
  if (!confirmationMatches(input.confirmation, input.summary, input.now))
    return { eligible: false, code: "CONFIRMATION_STALE" };
  return { eligible: true };
}
