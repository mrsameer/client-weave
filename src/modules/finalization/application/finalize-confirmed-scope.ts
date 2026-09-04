import { canonicalHash } from "@/modules/pricing/domain/canonicalize";
import {
  FinalizationRepository,
  type FinalizationResult
} from "@/db/repositories/finalization-repository";

export type FinalizeConfirmedScopeInput = {
  scopeId: string;
  workspaceId: string;
  scopeRevision: number;
  quoteId: string;
  summaryHash: string;
  action: "SUBMIT_LEAD" | "SUBMIT_LEAD_AND_BOOK";
  slotId?: string;
  contact: { name?: string; email?: string };
  idempotencyKey: string;
};

export type FinalizeConfirmedScopeResult =
  { ok: true; replayed: boolean; response: FinalizationResult } | { ok: false; code: string };

export async function finalizeConfirmedScope(
  repository: FinalizationRepository,
  input: FinalizeConfirmedScopeInput
): Promise<FinalizeConfirmedScopeResult> {
  const request = {
    ...input,
    requestHash: canonicalHash({
      scopeRevision: input.scopeRevision,
      quoteId: input.quoteId,
      summaryHash: input.summaryHash,
      action: input.action,
      ...(input.slotId ? { slotId: input.slotId } : {}),
      contact: input.contact
    })
  };
  let result: Awaited<ReturnType<FinalizationRepository["finalize"]>>;
  for (let attempt = 0; ; attempt += 1) {
    try {
      result = await repository.finalize(request);
      break;
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === 2) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
  if (result.kind === "rejected") return { ok: false, code: result.code };
  return { ok: true, replayed: result.kind === "replayed", response: result.response };
}

function isRetryableTransactionError(error: unknown): boolean {
  const code =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  // PostgreSQL serialization_failure and deadlock_detected are safe to replay because
  // the idempotency key is claimed within the transaction.
  return code === "40001" || code === "40P01";
}
