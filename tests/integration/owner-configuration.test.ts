import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ConfigurationRepository,
  ConfigurationRepositoryError
} from "../../src/db/repositories/configuration-repository";
import { CatalogRepository } from "../../src/db/repositories/catalog-repository";
import { AvailabilityRepository } from "../../src/db/repositories/availability-repository";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.runIf(Boolean(databaseUrl))("owner service configuration", () => {
  const client = postgres(databaseUrl!, { max: 1, prepare: false });
  const db = drizzle(client);
  const configuration = new ConfigurationRepository(db);
  const catalog = new CatalogRepository(db);
  const availability = new AvailabilityRepository(db);
  const workspaceId = randomUUID();
  const otherWorkspaceId = randomUUID();
  const validConfiguration = (name = "Launch plan") => ({
    name,
    description: "A configured service.",
    basePriceMinor: 10_000,
    deliveryMinDays: 3,
    deliveryMaxDays: 10,
    includedItems: ["Discovery"],
    fields: [{ key: "tier", type: "SELECT" as const, required: true, choices: ["standard"] }],
    rules: [
      {
        id: "tier_price",
        kind: "CONDITIONAL" as const,
        priority: 10,
        label: "Tier price",
        field: "tier",
        amountMinor: 5_000
      }
    ],
    constraints: [{ kind: "REQUIRES_FIELD" as const, field: "tier" }],
    activeServiceCount: 0
  });

  beforeAll(async () => {
    await client`
      INSERT INTO workspaces (id, name, timezone)
      VALUES (${workspaceId}, 'Configuration test', 'UTC'),
             (${otherWorkspaceId}, 'Other workspace', 'UTC')`;
  });

  afterAll(async () => client.end({ timeout: 5 }));

  it("preserves immutable service versions and only exposes the active pointer", async () => {
    const first = await configuration.publish({
      workspaceId,
      slug: "launch-plan",
      configuration: validConfiguration("Version one")
    });
    const second = await configuration.publish({
      workspaceId,
      serviceId: first.serviceId,
      slug: "launch-plan",
      configuration: validConfiguration("Version two")
    });
    expect([first.version, second.version]).toEqual([1, 2]);
    expect(first.serviceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(second.versionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(await configuration.versionHistory(workspaceId, first.serviceId)).toEqual([
      expect.objectContaining({
        version: 2,
        name: "Version two",
        activeVersionId: second.versionId
      }),
      expect.objectContaining({
        version: 1,
        name: "Version one",
        activeVersionId: second.versionId
      })
    ]);
    expect(await catalog.listPublicActive()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: "launch-plan", name: "Version two" })
      ])
    );
    await configuration.setActive({ workspaceId, serviceId: first.serviceId, active: false });
    expect((await catalog.listPublicActive()).map((service) => service.slug)).not.toContain(
      "launch-plan"
    );
    await expect(
      configuration.setActive({
        workspaceId: otherWorkspaceId,
        serviceId: first.serviceId,
        active: true
      })
    ).rejects.toMatchObject({
      code: "SERVICE_NOT_FOUND"
    } satisfies Partial<ConfigurationRepositoryError>);
    await expect(
      client`UPDATE service_versions SET name = 'rewritten' WHERE id = ${first.versionId}`
    ).rejects.toThrow(/service_versions history is immutable/);

    const slot = await availability.create({
      workspaceId,
      startsAt: new Date("2026-10-01T10:00:00Z"),
      endsAt: new Date("2026-10-01T11:00:00Z")
    });
    expect(
      await availability.listBookable(workspaceId, new Date("2026-09-01T00:00:00Z"), 10)
    ).toEqual(expect.arrayContaining([expect.objectContaining({ id: slot.id })]));
    await availability.block({ workspaceId, slotId: slot.id });
    expect(
      (await availability.listBookable(workspaceId, new Date("2026-09-01T00:00:00Z"), 10)).map(
        (candidate) => candidate.id
      )
    ).not.toContain(slot.id);
  });

  it("enforces the active-offering cap inside the workspace transaction", async () => {
    const existing = await configuration.publish({
      workspaceId,
      slug: "cap-draft",
      configuration: validConfiguration("Cap draft"),
      activate: false
    });
    await client`
      INSERT INTO service_offerings (workspace_id, slug, active)
      SELECT ${workspaceId}, 'active-cap-' || n, true FROM generate_series(1, 10) AS n`;
    await expect(
      configuration.setActive({ workspaceId, serviceId: existing.serviceId, active: true })
    ).rejects.toMatchObject({
      code: "ACTIVE_SERVICE_LIMIT"
    } satisfies Partial<ConfigurationRepositoryError>);
  });
});
