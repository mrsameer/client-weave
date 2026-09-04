import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { serviceOfferings, pricingRuleSets } from "./catalog";

export const scopeSessions = pgTable("scope_sessions", {
  id: uuid("id")
    .primaryKey()
    .default(sql`uuid_v7()`),
  ref: text("ref").notNull().unique(),
  serviceId: uuid("service_id")
    .notNull()
    .references(() => serviceOfferings.id),
  revision: integer("revision").notNull().default(1),
  goal: text("goal").notNull(),
  goalActor: text("goal_actor").notNull(),
  goalUpdatedAt: timestamp("goal_updated_at", { withTimezone: true }).notNull().defaultNow(),
  budgetMaxMinor: integer("budget_max_minor"),
  budgetActor: text("budget_actor").notNull(),
  budgetUpdatedAt: timestamp("budget_updated_at", { withTimezone: true }).notNull().defaultNow(),
  targetDeliveryDate: timestamp("target_delivery_date", { withTimezone: true }),
  deliveryActor: text("delivery_actor").notNull(),
  deliveryUpdatedAt: timestamp("delivery_updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const scopeParticipants = pgTable(
  "scope_participants",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuid_v7()`),
    scopeId: uuid("scope_id")
      .notNull()
      .references(() => scopeSessions.id),
    tokenHash: text("token_hash").notNull().unique(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("scope_participants_live_scope_idx")
      .on(table.scopeId)
      .where(sql`${table.revokedAt} IS NULL`)
  ]
);

export const scopeAssumptions = pgTable(
  "scope_assumptions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuid_v7()`),
    scopeId: uuid("scope_id")
      .notNull()
      .references(() => scopeSessions.id),
    value: text("value").notNull(),
    actor: text("actor").notNull(),
    displayOrder: integer("display_order").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("scope_assumption_order_once").on(table.scopeId, table.displayOrder)]
);

export const scopeAnswers = pgTable(
  "scope_answers",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuid_v7()`),
    scopeId: uuid("scope_id")
      .notNull()
      .references(() => scopeSessions.id),
    fieldKey: text("field_key").notNull(),
    value: jsonb("value"),
    actor: text("actor").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("scope_answer_once").on(table.scopeId, table.fieldKey)]
);

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuid_v7()`),
    scopeId: uuid("scope_id")
      .notNull()
      .references(() => scopeSessions.id),
    scopeRevision: integer("scope_revision").notNull(),
    ruleSetId: uuid("rule_set_id")
      .notNull()
      .references(() => pricingRuleSets.id),
    inputHash: text("input_hash").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    totalMinor: integer("total_minor").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("quote_deduplication").on(
      table.scopeId,
      table.scopeRevision,
      table.ruleSetId,
      table.inputHash
    )
  ]
);
