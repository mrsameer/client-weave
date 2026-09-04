import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ScopeRepository } from "../../../src/db/repositories/scope-repository";
import {
  requireScopeAccess,
  ScopeAccessDenied
} from "../../../src/server/authorization/scope-access";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.runIf(Boolean(databaseUrl))("scope capability authorization", () => {
  const client = postgres(databaseUrl!, { max: 1, prepare: false });
  const repository = new ScopeRepository(drizzle(client));
  const ids = {
    workspace: randomUUID(),
    service: randomUUID(),
    version: randomUUID()
  };
  const exchangeRef = `exchange-${randomUUID()}`;
  let liveScopeId = "";
  const tokens = {
    live: `live-${randomUUID()}`,
    other: `other-${randomUUID()}`,
    expired: `expired-${randomUUID()}`,
    fragment: `fragment-${randomUUID()}`,
    session: `session-${randomUUID()}`
  };

  beforeAll(async () => {
    await client`
      INSERT INTO workspaces (id, name, timezone) VALUES (${ids.workspace}, 'Authorization integration', 'UTC')`;
    await client`
      INSERT INTO service_offerings (id, workspace_id, slug, active)
      VALUES (${ids.service}, ${ids.workspace}, 'authorization-integration', true)`;
    await client`
      INSERT INTO service_versions (
        id, service_id, version, name, description, base_price_minor, currency,
        delivery_min_days, delivery_max_days, included_items
      ) VALUES (${ids.version}, ${ids.service}, 1, 'Authorization', 'Fixture', 1000, 'USD', 1, 7, '[]'::jsonb)`;
    await client`
      UPDATE service_offerings SET active_version_id = ${ids.version} WHERE id = ${ids.service}`;
    const live = await repository.create({
      ref: `live-${randomUUID()}`,
      serviceId: ids.service,
      goal: "Live scope",
      budgetMaxMinor: null,
      targetDeliveryDate: null,
      assumptions: [],
      answers: {},
      actor: "HUMAN",
      expiresAt: new Date(Date.now() + 60_000),
      tokenHash: tokens.live
    });
    liveScopeId = live.id;
    await repository.create({
      ref: `other-${randomUUID()}`,
      serviceId: ids.service,
      goal: "Other scope",
      budgetMaxMinor: null,
      targetDeliveryDate: null,
      assumptions: [],
      answers: {},
      actor: "HUMAN",
      expiresAt: new Date(Date.now() + 60_000),
      tokenHash: tokens.other
    });
    await repository.create({
      ref: `expired-${randomUUID()}`,
      serviceId: ids.service,
      goal: "Expired scope",
      budgetMaxMinor: null,
      targetDeliveryDate: null,
      assumptions: [],
      answers: {},
      actor: "HUMAN",
      expiresAt: new Date(Date.now() - 60_000),
      tokenHash: tokens.expired
    });
    await repository.create({
      ref: exchangeRef,
      serviceId: ids.service,
      goal: "Exchange scope",
      budgetMaxMinor: null,
      targetDeliveryDate: null,
      assumptions: [],
      answers: {},
      actor: "HUMAN",
      expiresAt: new Date(Date.now() + 60_000),
      tokenHash: tokens.fragment
    });
  });

  afterAll(async () => client.end({ timeout: 5 }));

  it("binds a capability to exactly one live scope and rejects expired or revoked access", async () => {
    const [live, other, expired] = await Promise.all([
      repository.findCapabilityAccessByHash(tokens.live),
      repository.findCapabilityAccessByHash(tokens.other),
      repository.findCapabilityAccessByHash(tokens.expired)
    ]);
    expect(live?.scopeId).toBe(liveScopeId);
    expect(other?.scopeId).not.toBe(liveScopeId);
    expect(() => requireScopeAccess(expired)).toThrow(ScopeAccessDenied);
    await client`
      UPDATE scope_participants SET revoked_at = now() WHERE token_hash = ${tokens.live}`;
    await expect(repository.findCapabilityAccessByHash(tokens.live)).resolves.toMatchObject({
      scopeId: liveScopeId,
      revokedAt: expect.anything()
    });
    const revoked = await repository.findCapabilityAccessByHash(tokens.live);
    expect(() => requireScopeAccess(revoked)).toThrow(ScopeAccessDenied);
  });

  it("consumes a fragment capability and mints one distinct browser-session capability", async () => {
    const exchanged = await repository.exchangeCapability({
      ref: exchangeRef,
      fragmentTokenHash: tokens.fragment,
      sessionTokenHash: tokens.session,
      now: new Date()
    });
    expect(exchanged).toEqual({ scopeId: expect.any(String) });
    expect(
      await repository.exchangeCapability({
        ref: exchangeRef,
        fragmentTokenHash: tokens.fragment,
        sessionTokenHash: `retry-${randomUUID()}`,
        now: new Date()
      })
    ).toBeNull();
    const consumed = await repository.findCapabilityAccessByHash(tokens.fragment);
    const session = await repository.findCapabilityAccessByHash(tokens.session);
    expect(() => requireScopeAccess(consumed)).toThrow(ScopeAccessDenied);
    expect(requireScopeAccess(session).scopeId).toBe(exchanged?.scopeId);
  });
});
