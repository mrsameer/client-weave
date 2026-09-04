import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { workspaces } from "./catalog";
import { quotes, scopeSessions } from "./scopes";

export const availabilitySlots = pgTable("availability_slots", {
  id: uuid("id")
    .primaryKey()
    .default(sql`uuid_v7()`),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  status: text("status", { enum: ["AVAILABLE", "BLOCKED", "BOOKED"] })
    .notNull()
    .default("AVAILABLE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
export const humanConfirmations = pgTable("human_confirmations", {
  id: uuid("id")
    .primaryKey()
    .default(sql`uuid_v7()`),
  scopeId: uuid("scope_id")
    .notNull()
    .references(() => scopeSessions.id),
  scopeRevision: integer("scope_revision").notNull(),
  summaryHash: text("summary_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
export const idempotencyRecords = pgTable(
  "idempotency_records",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuid_v7()`),
    scopeId: uuid("scope_id")
      .notNull()
      .references(() => scopeSessions.id),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    response: jsonb("response"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("idempotency_key_once").on(table.scopeId, table.key)]
);
export const qualifiedLeads = pgTable("qualified_leads", {
  id: uuid("id")
    .primaryKey()
    .default(sql`uuid_v7()`),
  scopeId: uuid("scope_id")
    .notNull()
    .unique()
    .references(() => scopeSessions.id),
  quoteId: uuid("quote_id")
    .notNull()
    .references(() => quotes.id),
  contact: jsonb("contact").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
export const bookings = pgTable("bookings", {
  id: uuid("id")
    .primaryKey()
    .default(sql`uuid_v7()`),
  scopeId: uuid("scope_id")
    .notNull()
    .unique()
    .references(() => scopeSessions.id),
  slotId: uuid("slot_id")
    .notNull()
    .unique()
    .references(() => availabilitySlots.id),
  leadId: uuid("lead_id")
    .notNull()
    .unique()
    .references(() => qualifiedLeads.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
