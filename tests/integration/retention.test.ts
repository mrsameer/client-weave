import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ScopeRepository } from "../../src/db/repositories/scope-repository";
import { deleteRetainedFinalizedScopes } from "../../src/modules/scope/application/expire-drafts";

const databaseUrl = process.env.TEST_DATABASE_URL;
const ids = {
  workspace: randomUUID(),
  service: randomUUID(),
  scope: randomUUID()
};

describe.runIf(Boolean(databaseUrl))("finalized retention", () => {
  const client = postgres(databaseUrl!, { max: 1, prepare: false });
  const repository = new ScopeRepository(drizzle(client));

  beforeAll(async () => {
    await client`
      INSERT INTO workspaces (id, name, timezone, retention_days)
      VALUES (${ids.workspace}, 'Retention test', 'UTC', 1)`;
    await client`
      INSERT INTO service_offerings (id, workspace_id, slug, active)
      VALUES (${ids.service}, ${ids.workspace}, ${`retention-${ids.service}`}, true)`;
    await client`
      INSERT INTO scope_sessions (id, ref, service_id, revision, goal, goal_actor, budget_max_minor, budget_actor, delivery_actor, expires_at, finalized_at)
      VALUES (${ids.scope}, ${`retention-${ids.scope}`}, ${ids.service}, 1, 'Delete after policy', 'HUMAN', 100, 'HUMAN', 'HUMAN', now() + interval '1 day', now() - interval '2 days')`;
    await client`
      INSERT INTO scope_participants (scope_id, token_hash) VALUES (${ids.scope}, ${`retention-token-${ids.scope}`})`;
  });

  afterAll(async () => client.end({ timeout: 5 }));

  it("removes finalized scope data after the workspace retention period and retains an unlinked audit", async () => {
    expect(await deleteRetainedFinalizedScopes(repository, new Date())).toBe(1);
    const [scopes, audit] = await Promise.all([
      client`SELECT id FROM scope_sessions WHERE id = ${ids.scope}`,
      client`SELECT scope_id, action FROM audit_events WHERE workspace_id = ${ids.workspace}`
    ]);
    expect(scopes).toHaveLength(0);
    expect(audit).toEqual([
      expect.objectContaining({ scope_id: null, action: "FINALIZED_SCOPE_RETENTION_DELETED" })
    ]);
  });
});
import { randomUUID } from "node:crypto";
