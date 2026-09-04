import { and, eq } from "drizzle-orm";
import {
  pricingRuleSets,
  pricingRules,
  serviceOfferings,
  serviceVersions,
  serviceConstraints
} from "@/db/schema/catalog";
import type { createRuntimeDatabase } from "@/db/client";
import type { ServiceOffering } from "@/modules/catalog/domain/service";

type Database = ReturnType<typeof createRuntimeDatabase>;

export class CatalogRepository {
  constructor(private readonly db: Database) {}

  async listActive(workspaceId: string): Promise<ServiceOffering[]> {
    const rows = await this.db
      .select({
        slug: serviceOfferings.slug,
        name: serviceVersions.name,
        description: serviceVersions.description,
        basePriceMinor: serviceVersions.basePriceMinor,
        deliveryMinDays: serviceVersions.deliveryMinDays,
        deliveryMaxDays: serviceVersions.deliveryMaxDays,
        includedItems: serviceVersions.includedItems
      })
      .from(serviceOfferings)
      .innerJoin(serviceVersions, eq(serviceOfferings.activeVersionId, serviceVersions.id))
      .where(and(eq(serviceOfferings.workspaceId, workspaceId), eq(serviceOfferings.active, true)));
    return rows.map((row) => ({
      ...row,
      active: true,
      includedItems: row.includedItems as string[]
    }));
  }

  async listPublicActive(): Promise<ServiceOffering[]> {
    const rows = await this.db
      .select({
        slug: serviceOfferings.slug,
        name: serviceVersions.name,
        description: serviceVersions.description,
        basePriceMinor: serviceVersions.basePriceMinor,
        deliveryMinDays: serviceVersions.deliveryMinDays,
        deliveryMaxDays: serviceVersions.deliveryMaxDays,
        includedItems: serviceVersions.includedItems
      })
      .from(serviceOfferings)
      .innerJoin(serviceVersions, eq(serviceOfferings.activeVersionId, serviceVersions.id))
      .where(eq(serviceOfferings.active, true));
    return rows.map((row) => ({
      ...row,
      active: true,
      includedItems: row.includedItems as string[]
    }));
  }

  async findPublicActiveBySlug(slug: string) {
    const [service] = await this.db
      .select({ id: serviceOfferings.id, slug: serviceOfferings.slug })
      .from(serviceOfferings)
      .innerJoin(serviceVersions, eq(serviceOfferings.activeVersionId, serviceVersions.id))
      .where(and(eq(serviceOfferings.slug, slug), eq(serviceOfferings.active, true)));
    return service ?? null;
  }

  async getCurrentPricing(serviceId: string) {
    const [version] = await this.db
      .select({
        id: serviceVersions.id,
        basePriceMinor: serviceVersions.basePriceMinor,
        currency: serviceVersions.currency
      })
      .from(serviceOfferings)
      .innerJoin(serviceVersions, eq(serviceOfferings.activeVersionId, serviceVersions.id))
      .where(and(eq(serviceOfferings.id, serviceId), eq(serviceOfferings.active, true)));
    if (!version) return null;
    const [ruleSet] = await this.db
      .select()
      .from(pricingRuleSets)
      .where(eq(pricingRuleSets.serviceVersionId, version.id));
    if (!ruleSet) return null;
    const rules = await this.db
      .select()
      .from(pricingRules)
      .where(eq(pricingRules.ruleSetId, ruleSet.id));
    return {
      basePriceMinor: version.basePriceMinor,
      currency: version.currency,
      ruleSetId: ruleSet.id,
      ruleSetVersion: ruleSet.version,
      rules: rules
        .filter((rule) => (rule.definition as { kind?: string }).kind !== "BASE")
        .map((rule) => ({ id: rule.id, priority: rule.priority, ...(rule.definition as object) }))
    };
  }

  async workspaceIdForService(serviceId: string) {
    const [service] = await this.db
      .select({ workspaceId: serviceOfferings.workspaceId })
      .from(serviceOfferings)
      .where(eq(serviceOfferings.id, serviceId));
    return service?.workspaceId ?? null;
  }

  async getCurrentConstraints(serviceId: string) {
    return this.db
      .select({ definition: serviceConstraints.definition })
      .from(serviceOfferings)
      .innerJoin(serviceVersions, eq(serviceOfferings.activeVersionId, serviceVersions.id))
      .innerJoin(serviceConstraints, eq(serviceConstraints.serviceVersionId, serviceVersions.id))
      .where(and(eq(serviceOfferings.id, serviceId), eq(serviceOfferings.active, true)));
  }
}
