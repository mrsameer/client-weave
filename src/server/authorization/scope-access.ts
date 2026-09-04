export class ScopeAccessDenied extends Error {
  constructor() {
    super("Scope unavailable");
  }
}

export type ScopeAccess = { scopeId: string; expiresAt: Date; revokedAt: Date | null };

export function requireScopeAccess(access: ScopeAccess | null, now = new Date()): ScopeAccess {
  if (!access || access.revokedAt || access.expiresAt <= now) throw new ScopeAccessDenied();
  return access;
}
