import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { workspaces } from "./catalog";
import { scopeSessions } from "./scopes";

export const auditEvents = pgTable("audit_events", {
  id: uuid("id")
    .primaryKey()
    .default(sql`uuid_v7()`),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  scopeId: uuid("scope_id").references(() => scopeSessions.id),
  actor: text("actor", { enum: ["HUMAN", "AGENT", "IMPORTED", "SYSTEM"] }).notNull(),
  action: text("action").notNull(),
  outcome: text("outcome", { enum: ["SUCCEEDED", "REJECTED", "FAILED"] }).notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const agentInvocations = pgTable("agent_invocations", {
  id: uuid("id")
    .primaryKey()
    .default(sql`uuid_v7()`),
  scopeId: uuid("scope_id").references(() => scopeSessions.id),
  capability: text("capability").notNull(),
  stateEffect: text("state_effect", {
    enum: ["READ_ONLY", "DRAFT_MUTATION", "DERIVED_RECORD_WRITE", "CONSEQUENTIAL_WRITE"]
  }).notNull(),
  outcome: text("outcome", { enum: ["SUCCEEDED", "REJECTED", "FAILED"] }).notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const publicRateLimits = pgTable("public_rate_limits", {
  key: text("key").primaryKey(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  requestCount: integer("request_count").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
