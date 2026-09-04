import type { ScopeMutation, StoredScope, TrustedActor } from "@/db/repositories/scope-repository";
import { trustedPatchActor, validateScopePatch, type ScopePatch } from "../domain/scope-patch";

export interface ScopeMutator {
  update(scopeId: string, mutation: ScopeMutation): Promise<StoredScope | null>;
}

export type UpdateScopeInput = {
  scopeId: string;
  expectedRevision: number;
  actor: TrustedActor;
  patch: unknown;
};

/** Applies only the typed, server-attributed patch to the shared revisioned scope. */
export async function updateScope(
  mutator: ScopeMutator,
  input: UpdateScopeInput
): Promise<StoredScope | null> {
  const patch = validateScopePatch(input.patch);
  const actor = trustedPatchActor(input.actor);
  return mutator.update(input.scopeId, toMutation(patch, input.expectedRevision, actor));
}

export function toMutation(
  patch: ScopePatch,
  expectedRevision: number,
  actor: TrustedActor
): ScopeMutation {
  return {
    ...(patch.goal === undefined ? {} : { goal: patch.goal }),
    ...(patch.budgetMaxMinor === undefined ? {} : { budgetMaxMinor: patch.budgetMaxMinor }),
    ...(patch.targetDeliveryDate === undefined
      ? {}
      : {
          targetDeliveryDate:
            patch.targetDeliveryDate === null
              ? null
              : new Date(`${patch.targetDeliveryDate}T00:00:00.000Z`)
        }),
    ...(patch.assumptions === undefined ? {} : { assumptions: patch.assumptions }),
    ...(patch.answers === undefined ? {} : { answers: patch.answers }),
    expectedRevision,
    actor
  };
}
