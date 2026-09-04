import { createScopeCapability, hashScopeSecret } from "../../../server/auth/scope-capability";
import { normalizeScope, type NormalizedScope } from "../domain/normalize-scope";
import type {
  NewScope,
  StoredScope,
  TrustedActor
} from "../../../db/repositories/scope-repository";

export interface ScopeWriter {
  create(input: NewScope): Promise<StoredScope>;
}
export type CreateScopeInput = NormalizedScope & { serviceId: string; actor: TrustedActor };

export async function createScope(
  writer: ScopeWriter,
  input: CreateScopeInput,
  scopePepper: string,
  now = new Date()
) {
  const normalized = normalizeScope(input);
  const capability = createScopeCapability();
  const expiresAt = new Date(now);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 30);
  const scope = await writer.create({
    ...normalized,
    targetDeliveryDate: normalized.targetDeliveryDate
      ? new Date(`${normalized.targetDeliveryDate}T00:00:00.000Z`)
      : null,
    ref: capability.reference,
    serviceId: input.serviceId,
    actor: input.actor,
    expiresAt,
    tokenHash: hashScopeSecret(capability.secret, scopePepper)
  });
  return { scope, capability, continuationUrl: `/s/${capability.reference}#${capability.secret}` };
}
