import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
};

export const workspaces = pgTable("workspaces", {
  id: uuid("id")
    .primaryKey()
    .default(sql`uuid_v7()`),
  name: text("name").notNull(),
  timezone: text("timezone").notNull(),
  retentionDays: integer("retention_days").notNull().default(365),
  ...auditColumns
});
export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuid_v7()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    userId: uuid("user_id").notNull(),
    role: text("role", { enum: ["OWNER"] }).notNull(),
    ...auditColumns
  },
  (table) => [uniqueIndex("workspace_member_once").on(table.workspaceId, table.userId)]
);
export const serviceOfferings = pgTable(
  "service_offerings",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuid_v7()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    slug: text("slug").notNull(),
    active: boolean("active").notNull().default(false),
    activeVersionId: uuid("active_version_id"),
    ...auditColumns
  },
  (table) => [uniqueIndex("service_slug_per_workspace").on(table.workspaceId, table.slug)]
);
export const serviceVersions = pgTable(
  "service_versions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuid_v7()`),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => serviceOfferings.id),
    version: integer("version").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    basePriceMinor: integer("base_price_minor").notNull(),
    currency: text("currency").notNull(),
    deliveryMinDays: integer("delivery_min_days").notNull(),
    deliveryMaxDays: integer("delivery_max_days").notNull(),
    includedItems: jsonb("included_items").notNull(),
    ...auditColumns
  },
  (table) => [uniqueIndex("service_version_once").on(table.serviceId, table.version)]
);
export const scopeFields = pgTable(
  "scope_fields",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuid_v7()`),
    serviceVersionId: uuid("service_version_id")
      .notNull()
      .references(() => serviceVersions.id),
    key: text("key").notNull(),
    definition: jsonb("definition").notNull(),
    displayOrder: integer("display_order").notNull(),
    ...auditColumns
  },
  (table) => [uniqueIndex("field_key_per_version").on(table.serviceVersionId, table.key)]
);
export const pricingRuleSets = pgTable(
  "pricing_rule_sets",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuid_v7()`),
    serviceVersionId: uuid("service_version_id")
      .notNull()
      .references(() => serviceVersions.id),
    version: integer("version").notNull(),
    evaluatorVersion: text("evaluator_version").notNull(),
    contentHash: text("content_hash").notNull(),
    ...auditColumns
  },
  (table) => [uniqueIndex("rule_set_version_once").on(table.serviceVersionId, table.version)]
);
export const pricingRules = pgTable("pricing_rules", {
  id: uuid("id")
    .primaryKey()
    .default(sql`uuid_v7()`),
  ruleSetId: uuid("rule_set_id")
    .notNull()
    .references(() => pricingRuleSets.id),
  priority: integer("priority").notNull(),
  definition: jsonb("definition").notNull(),
  ...auditColumns
});
export const serviceConstraints = pgTable("service_constraints", {
  id: uuid("id")
    .primaryKey()
    .default(sql`uuid_v7()`),
  serviceVersionId: uuid("service_version_id")
    .notNull()
    .references(() => serviceVersions.id),
  definition: jsonb("definition").notNull(),
  ...auditColumns
});
