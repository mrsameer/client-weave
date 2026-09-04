import { requireScopeAccess, type ScopeAccess } from "../authorization/scope-access";

export type ScopeInvalidation = { scopeId: string; revision: number; changedAt: string };
type Listener = (event: ScopeInvalidation) => void;

/** A transport-neutral private topic registry. Events contain no scope content. */
export class ScopeBroadcast {
  private readonly listeners = new Map<string, Set<Listener>>();
  publish(event: ScopeInvalidation): void {
    for (const listener of this.listeners.get(event.scopeId) ?? []) listener(event);
  }
  subscribe(access: ScopeAccess | null, listener: Listener): () => void {
    const scope = requireScopeAccess(access);
    const listeners = this.listeners.get(scope.scopeId) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(scope.scopeId, listeners);
    return () => {
      listeners.delete(listener);
    };
  }
}

const globalScopeBroadcast = globalThis as typeof globalThis & {
  __clientweaveScopeBroadcast?: ScopeBroadcast;
};

/** Process-local transport for the SSE endpoint. Polling covers cross-instance delivery. */
export const scopeBroadcast =
  globalScopeBroadcast.__clientweaveScopeBroadcast ??
  (globalScopeBroadcast.__clientweaveScopeBroadcast = new ScopeBroadcast());
