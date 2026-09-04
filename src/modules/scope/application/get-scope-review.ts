import type { StoredScope } from "@/db/repositories/scope-repository";

export interface ScopeReader {
  getByReference(ref: string): Promise<StoredScope>;
}

export async function getScopeReview(reader: ScopeReader, ref: string) {
  const scope = await reader.getByReference(ref);
  if (scope.expiresAt <= new Date()) throw new Error("Scope unavailable");
  return scope;
}
