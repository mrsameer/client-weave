import { and, count, desc, eq, sql } from "drizzle-orm";
import type { createRuntimeDatabase } from "@/db/client";
import {
  pricingRuleSets,
  pricingRules,
  scopeFields,
  serviceConstraints,
  serviceOfferings,
  serviceVersions
} from "@/db/schema/catalog";
import { auditEvents } from "@/db/schema/audit";
import { canonicalHash } from "@/modules/pricing/domain/canonicalize";
import type {
  ConfigurationConstraint,
  ConfigurationField,
  ConfigurationRule,
  ServiceConfiguration
} from "@/modules/catalog/domain/service-configuration";

type Database = ReturnType<typeof createRuntimeDatabase>;

export type PublishedService = {
  serviceId: string;
  versionId: string;
  version: number;
  ruleSetId: string;
};

/** Persists append-only service graphs; only the offering's active pointer is mutable. */
export class ConfigurationRepository {
  constructor(private readonly db: Database) {}

  async publish(input: {
    workspaceId: string;
    slug: string;
    configuration: ServiceConfiguration;
    serviceId?: string;
    activate?: boolean;
  }): Promise<PublishedService> {
    return this.db.transaction(async (tx) => {
      const workspace = await tx.execute(
        sql`SELECT id FROM workspaces WHERE id = ${input.workspaceId} FOR UPDATE`
      );
      if (!workspace[0]) throw new ConfigurationRepositoryError("WORKSPACE_NOT_FOUND");
      // The version base price is the sole BASE line; executable evaluator rules
      // are the non-base append-only definitions below.
      const pricedRules = input.configuration.rules.filter((rule) => rule.kind !== "BASE");
      let serviceId = input.serviceId;
      let currentlyActive = false;
      if (serviceId) {
        // Serializes version allocation and active-pointer movement for one offering.
        const locked = await tx.execute<{ id: string; active: boolean }>(
          sql`SELECT id, active FROM service_offerings WHERE id = ${serviceId} AND workspace_id = ${input.workspaceId} FOR UPDATE`
        );
        const owned = locked[0];
        if (!owned) throw new ConfigurationRepositoryError("SERVICE_NOT_FOUND");
        currentlyActive = owned.active;
      } else {
        const [created] = await tx
          .insert(serviceOfferings)
          .values({ workspaceId: input.workspaceId, slug: input.slug, active: false })
          .returning({ id: serviceOfferings.id });
        if (!created) throw new Error("Service insert did not return a record");
        serviceId = created.id;
      }

      if ((input.activate ?? true) && !currentlyActive) {
        const [activeServices] = await tx
          .select({ value: count() })
          .from(serviceOfferings)
          .where(
            and(
              eq(serviceOfferings.workspaceId, input.workspaceId),
              eq(serviceOfferings.active, true)
            )
          );
        if ((activeServices?.value ?? 0) >= 10)
          throw new ConfigurationRepositoryError("ACTIVE_SERVICE_LIMIT");
      }

      const [latest] = await tx
        .select({ version: serviceVersions.version })
        .from(serviceVersions)
        .where(eq(serviceVersions.serviceId, serviceId))
        .orderBy(desc(serviceVersions.version))
        .limit(1);
      const version = (latest?.version ?? 0) + 1;
      const [serviceVersion] = await tx
        .insert(serviceVersions)
        .values({
          serviceId,
          version,
          name: input.configuration.name,
          description: input.configuration.description,
          basePriceMinor: input.configuration.basePriceMinor,
          currency: "USD",
          deliveryMinDays: input.configuration.deliveryMinDays,
          deliveryMaxDays: input.configuration.deliveryMaxDays,
          includedItems: input.configuration.includedItems
        })
        .returning({ id: serviceVersions.id });
      if (!serviceVersion) throw new Error("Service version insert did not return a record");

      if (input.configuration.fields.length)
        await tx.insert(scopeFields).values(
          input.configuration.fields.map((field, displayOrder) => ({
            serviceVersionId: serviceVersion.id,
            key: field.key,
            definition: field,
            displayOrder
          }))
        );
      if (input.configuration.constraints?.length)
        await tx.insert(serviceConstraints).values(
          input.configuration.constraints.map((definition) => ({
            serviceVersionId: serviceVersion.id,
            definition
          }))
        );
      const [ruleSet] = await tx
        .insert(pricingRuleSets)
        .values({
          serviceVersionId: serviceVersion.id,
          version,
          evaluatorVersion: "v1",
          contentHash: canonicalHash(pricedRules)
        })
        .returning({ id: pricingRuleSets.id });
      if (!ruleSet) throw new Error("Pricing rule set insert did not return a record");
      if (pricedRules.length)
        await tx.insert(pricingRules).values(
          pricedRules.map((rule) => ({
            ruleSetId: ruleSet.id,
            priority: rule.priority,
            definition: rule
          }))
        );

      if (input.activate ?? true)
        await tx
          .update(serviceOfferings)
          .set({ active: true, activeVersionId: serviceVersion.id, updatedAt: new Date() })
          .where(
            and(
              eq(serviceOfferings.id, serviceId),
              eq(serviceOfferings.workspaceId, input.workspaceId)
            )
          );
      await tx.insert(auditEvents).values({
        workspaceId: input.workspaceId,
        actor: "HUMAN",
        action: "SERVICE_VERSION_PUBLISHED",
        outcome: "SUCCEEDED",
        metadata: { serviceId, version }
      });
      return { serviceId, versionId: serviceVersion.id, version, ruleSetId: ruleSet.id };
    });
  }

  async setActive(input: { workspaceId: string; serviceId: string; active: boolean }) {
    await this.db.transaction(async (tx) => {
      const workspace = await tx.execute(
        sql`SELECT id FROM workspaces WHERE id = ${input.workspaceId} FOR UPDATE`
      );
      if (!workspace[0]) throw new ConfigurationRepositoryError("WORKSPACE_NOT_FOUND");
      const locked = await tx.execute<{ id: string; active: boolean }>(
        sql`SELECT id, active FROM service_offerings WHERE id = ${input.serviceId} AND workspace_id = ${input.workspaceId} FOR UPDATE`
      );
      const service = locked[0];
      if (!service) throw new ConfigurationRepositoryError("SERVICE_NOT_FOUND");
      if (input.active && !service.active) {
        const [activeServices] = await tx
          .select({ value: count() })
          .from(serviceOfferings)
          .where(
            and(
              eq(serviceOfferings.workspaceId, input.workspaceId),
              eq(serviceOfferings.active, true)
            )
          );
        if ((activeServices?.value ?? 0) >= 10)
          throw new ConfigurationRepositoryError("ACTIVE_SERVICE_LIMIT");
      }
      await tx
        .update(serviceOfferings)
        .set({ active: input.active, updatedAt: new Date() })
        .where(eq(serviceOfferings.id, input.serviceId));
      await tx.insert(auditEvents).values({
        workspaceId: input.workspaceId,
        actor: "HUMAN",
        action: input.active ? "SERVICE_ACTIVATED" : "SERVICE_DEACTIVATED",
        outcome: "SUCCEEDED",
        metadata: { serviceId: input.serviceId }
      });
    });
  }

  async listForWorkspace(workspaceId: string) {
    return this.db
      .select({
        id: serviceOfferings.id,
        slug: serviceOfferings.slug,
        active: serviceOfferings.active,
        activeVersionId: serviceOfferings.activeVersionId,
        updatedAt: serviceOfferings.updatedAt
      })
      .from(serviceOfferings)
      .where(eq(serviceOfferings.workspaceId, workspaceId))
      .orderBy(serviceOfferings.slug);
  }

  /** Rehydrates the active immutable graph so an owner edit starts from vN, not a blank template. */
  async activeConfiguration(
    workspaceId: string,
    serviceId: string
  ): Promise<ServiceConfiguration | null> {
    const [version] = await this.db
      .select({
        id: serviceVersions.id,
        name: serviceVersions.name,
        description: serviceVersions.description,
        basePriceMinor: serviceVersions.basePriceMinor,
        deliveryMinDays: serviceVersions.deliveryMinDays,
        deliveryMaxDays: serviceVersions.deliveryMaxDays,
        includedItems: serviceVersions.includedItems
      })
      .from(serviceOfferings)
      .innerJoin(serviceVersions, eq(serviceOfferings.activeVersionId, serviceVersions.id))
      .where(
        and(eq(serviceOfferings.workspaceId, workspaceId), eq(serviceOfferings.id, serviceId))
      );
    if (!version) return null;
    const [fields, constraints, ruleSets] = await Promise.all([
      this.db
        .select({ definition: scopeFields.definition })
        .from(scopeFields)
        .where(eq(scopeFields.serviceVersionId, version.id))
        .orderBy(scopeFields.displayOrder),
      this.db
        .select({ definition: serviceConstraints.definition })
        .from(serviceConstraints)
        .where(eq(serviceConstraints.serviceVersionId, version.id)),
      this.db
        .select({ id: pricingRuleSets.id })
        .from(pricingRuleSets)
        .where(eq(pricingRuleSets.serviceVersionId, version.id))
        .limit(1)
    ]);
    const ruleSet = ruleSets[0];
    const rules = ruleSet
      ? await this.db
          .select({ definition: pricingRules.definition })
          .from(pricingRules)
          .where(eq(pricingRules.ruleSetId, ruleSet.id))
          .orderBy(pricingRules.priority)
      : [];
    return {
      name: version.name,
      description: version.description,
      basePriceMinor: version.basePriceMinor,
      deliveryMinDays: version.deliveryMinDays,
      deliveryMaxDays: version.deliveryMaxDays,
      includedItems: version.includedItems as string[],
      fields: fields.map((field) => field.definition as ConfigurationField),
      rules: [
        {
          id: "base",
          kind: "BASE",
          priority: 0,
          label: "Base service",
          amountMinor: version.basePriceMinor
        },
        ...rules.map((rule) => rule.definition as ConfigurationRule)
      ],
      constraints: constraints.map(
        (constraint) => constraint.definition as ConfigurationConstraint
      ),
      activeServiceCount: (await this.listForWorkspace(workspaceId)).filter(
        (service) => service.active
      ).length
    };
  }

  async versionHistory(workspaceId: string, serviceId: string) {
    return this.db
      .select({
        versionId: serviceVersions.id,
        version: serviceVersions.version,
        name: serviceVersions.name,
        ruleSetVersion: pricingRuleSets.version,
        createdAt: serviceVersions.createdAt,
        activeVersionId: serviceOfferings.activeVersionId
      })
      .from(serviceVersions)
      .innerJoin(serviceOfferings, eq(serviceVersions.serviceId, serviceOfferings.id))
      .leftJoin(pricingRuleSets, eq(pricingRuleSets.serviceVersionId, serviceVersions.id))
      .where(and(eq(serviceOfferings.workspaceId, workspaceId), eq(serviceOfferings.id, serviceId)))
      .orderBy(desc(serviceVersions.version));
  }
}

export class ConfigurationRepositoryError extends Error {
  constructor(readonly code: "ACTIVE_SERVICE_LIMIT" | "SERVICE_NOT_FOUND" | "WORKSPACE_NOT_FOUND") {
    super(code);
  }
}
