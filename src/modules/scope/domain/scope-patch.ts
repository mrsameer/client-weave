import type { ScopeValue, TrustedActor } from "@/db/repositories/scope-repository";

export type ScopePatch = {
  goal?: string;
  budgetMaxMinor?: number | null;
  targetDeliveryDate?: string | null;
  assumptions?: string[];
  answers?: Record<string, ScopeValue>;
};

export type PatchImpact = { general: boolean; pricing: boolean; finalization: boolean };

export function validateScopePatch(input: unknown): ScopePatch {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new TypeError("Scope patch must be an object");
  const patch = input as Record<string, unknown>;
  const allowed = new Set([
    "goal",
    "budgetMaxMinor",
    "targetDeliveryDate",
    "assumptions",
    "answers"
  ]);
  for (const key of Object.keys(patch))
    if (!allowed.has(key)) throw new TypeError(`Unsupported scope patch field: ${key}`);
  if (Object.keys(patch).length === 0) throw new TypeError("Scope patch cannot be empty");
  if (
    patch.goal !== undefined &&
    (typeof patch.goal !== "string" || patch.goal.trim().length === 0 || patch.goal.length > 1000)
  )
    throw new TypeError("Goal must be bounded text");
  if (
    patch.budgetMaxMinor !== undefined &&
    patch.budgetMaxMinor !== null &&
    (!Number.isInteger(patch.budgetMaxMinor) || (patch.budgetMaxMinor as number) < 0)
  )
    throw new TypeError("Budget must be a non-negative integer or null");
  if (
    patch.targetDeliveryDate !== undefined &&
    patch.targetDeliveryDate !== null &&
    (typeof patch.targetDeliveryDate !== "string" ||
      Number.isNaN(Date.parse(patch.targetDeliveryDate)))
  )
    throw new TypeError("Target delivery date must be an ISO date or null");
  if (
    patch.assumptions !== undefined &&
    (!Array.isArray(patch.assumptions) ||
      patch.assumptions.length > 20 ||
      patch.assumptions.some(
        (value) => typeof value !== "string" || value.trim().length === 0 || value.length > 500
      ))
  )
    throw new TypeError("Assumptions must be a bounded list");
  if (
    patch.answers !== undefined &&
    (!patch.answers || typeof patch.answers !== "object" || Array.isArray(patch.answers))
  )
    throw new TypeError("Answers must be an object");
  if (patch.answers !== undefined) {
    const entries = Object.entries(patch.answers as Record<string, unknown>);
    if (entries.length > 50) throw new TypeError("Answers must contain at most 50 fields");
    for (const [key, value] of entries) {
      const validValue =
        value === null ||
        typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value)) ||
        (typeof value === "string" && value.length <= 4000) ||
        (Array.isArray(value) &&
          value.length <= 20 &&
          value.every((entry) => typeof entry === "string" && entry.length <= 200));
      if (!/^[a-z][a-z0-9_]{1,99}$/.test(key) || !validValue)
        throw new TypeError("Answers must use bounded typed values and stable field keys");
    }
  }
  return patch as ScopePatch;
}

export function classifyPatchImpact(
  patch: ScopePatch,
  priceAffectingFields: ReadonlySet<string>
): PatchImpact {
  const answerChangesPrice = Object.keys(patch.answers ?? {}).some((key) =>
    priceAffectingFields.has(key)
  );
  const pricing =
    patch.budgetMaxMinor !== undefined ||
    patch.targetDeliveryDate !== undefined ||
    answerChangesPrice;
  return { general: true, pricing, finalization: true };
}

export function trustedPatchActor(actor: TrustedActor): TrustedActor {
  if (!["HUMAN", "AGENT", "IMPORTED", "SYSTEM"].includes(actor))
    throw new TypeError("Actor must be server-derived");
  return actor;
}
