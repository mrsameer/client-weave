import { canonicalHash } from "../../pricing/domain/canonicalize";

export type FinalSummaryInput = {
  scopeRevision: number;
  quoteId: string;
  quoteTotalMinor: number;
  contact: { name?: string; email?: string };
  action: "SUBMIT_LEAD" | "SUBMIT_LEAD_AND_BOOK";
  slotId?: string;
  nonce: string;
  retentionNotice: string;
  /** JSON-safe, attributed records used to render the exact reviewed state. */
  scopeSnapshot: Record<string, unknown>;
  quoteSnapshot: Record<string, unknown>;
  serviceConstraints: unknown[];
};
export type FinalSummary = FinalSummaryInput & { hash: string; expiresAt: Date };

export function createFinalSummary(input: FinalSummaryInput, now = new Date()): FinalSummary {
  if (input.action === "SUBMIT_LEAD_AND_BOOK" && !input.slotId)
    throw new TypeError("Booking requires a selected slot");
  if (!input.contact.email && !input.contact.name)
    throw new TypeError("At least one contact method is required");
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(input.nonce))
    throw new TypeError("Final review requires a nonce");
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  return { ...input, hash: canonicalHash(input), expiresAt };
}

export function confirmationMatches(
  summary: FinalSummary,
  current: FinalSummaryInput,
  now = new Date()
): boolean {
  return summary.expiresAt > now && summary.hash === canonicalHash(current);
}
