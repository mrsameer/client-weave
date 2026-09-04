import { createFinalSummary, type FinalSummaryInput } from "../domain/final-summary";

export interface HumanConfirmationWriter {
  record(input: {
    summaryHash: string;
    scopeRevision: number;
    expiresAt: Date;
    confirmedBy: "HUMAN";
  }): Promise<{ id: string }>;
}

export async function recordHumanConfirmation(
  writer: HumanConfirmationWriter,
  input: FinalSummaryInput,
  actor: "HUMAN" | "AGENT",
  now = new Date()
) {
  if (actor !== "HUMAN")
    throw new Error("Human confirmation must originate from the ordinary user interface");
  const summary = createFinalSummary(input, now);
  const confirmation = await writer.record({
    summaryHash: summary.hash,
    scopeRevision: input.scopeRevision,
    expiresAt: summary.expiresAt,
    confirmedBy: "HUMAN"
  });
  return { ...confirmation, summary };
}
