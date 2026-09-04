export type ExpirableScope = {
  id: string;
  expiresAt: Date;
};

export interface DraftRetentionStore {
  findExpiredDrafts(now: Date): Promise<ExpirableScope[]>;
  expireAndRevoke(scopeId: string, now: Date): Promise<void>;
}

export type RetainedFinalizedScope = { id: string; workspaceId: string };

export interface FinalizedRetentionStore {
  findFinalizedPastRetention(now: Date): Promise<RetainedFinalizedScope[]>;
  deleteFinalizedForRetention(scope: RetainedFinalizedScope, now: Date): Promise<void>;
}

export async function expireDrafts(store: DraftRetentionStore, now = new Date()): Promise<number> {
  const expired = await store.findExpiredDrafts(now);
  let processed = 0;
  for (const scope of expired) {
    if (scope.expiresAt <= now) {
      await store.expireAndRevoke(scope.id, now);
      processed += 1;
    }
  }
  return processed;
}

export async function deleteRetainedFinalizedScopes(
  store: FinalizedRetentionStore,
  now = new Date()
): Promise<number> {
  const scopes = await store.findFinalizedPastRetention(now);
  for (const scope of scopes) await store.deleteFinalizedForRetention(scope, now);
  return scopes.length;
}
