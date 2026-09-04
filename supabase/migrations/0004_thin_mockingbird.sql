-- PostgreSQL 16 has no built-in UUIDv7 generator. This time-ordered generator
-- follows the UUIDv7 layout (48-bit Unix milliseconds, version 7, RFC variant).
CREATE OR REPLACE FUNCTION uuid_v7() RETURNS uuid LANGUAGE sql VOLATILE AS $$
  WITH parts AS (
    SELECT
      lpad(to_hex(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint), 12, '0') AS time_hex,
      md5(random()::text || clock_timestamp()::text) AS random_hex
  )
  SELECT (
    substr(time_hex, 1, 8) || '-' || substr(time_hex, 9, 4) ||
    '-7' || substr(random_hex, 1, 3) || '-' ||
    substr('89ab', floor(random() * 4)::integer + 1, 1) || substr(random_hex, 4, 3) || '-' ||
    substr(random_hex, 7, 12)
  )::uuid FROM parts;
$$;--> statement-breakpoint

ALTER TABLE "agent_invocations" ALTER COLUMN "id" SET DEFAULT uuid_v7();--> statement-breakpoint
ALTER TABLE "audit_events" ALTER COLUMN "id" SET DEFAULT uuid_v7();--> statement-breakpoint
ALTER TABLE "pricing_rule_sets" ALTER COLUMN "id" SET DEFAULT uuid_v7();--> statement-breakpoint
ALTER TABLE "pricing_rules" ALTER COLUMN "id" SET DEFAULT uuid_v7();--> statement-breakpoint
ALTER TABLE "scope_fields" ALTER COLUMN "id" SET DEFAULT uuid_v7();--> statement-breakpoint
ALTER TABLE "service_constraints" ALTER COLUMN "id" SET DEFAULT uuid_v7();--> statement-breakpoint
ALTER TABLE "service_offerings" ALTER COLUMN "id" SET DEFAULT uuid_v7();--> statement-breakpoint
ALTER TABLE "service_versions" ALTER COLUMN "id" SET DEFAULT uuid_v7();--> statement-breakpoint
ALTER TABLE "workspace_members" ALTER COLUMN "id" SET DEFAULT uuid_v7();--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "id" SET DEFAULT uuid_v7();--> statement-breakpoint
ALTER TABLE "availability_slots" ALTER COLUMN "id" SET DEFAULT uuid_v7();--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "id" SET DEFAULT uuid_v7();--> statement-breakpoint
ALTER TABLE "human_confirmations" ALTER COLUMN "id" SET DEFAULT uuid_v7();--> statement-breakpoint
ALTER TABLE "idempotency_records" ALTER COLUMN "id" SET DEFAULT uuid_v7();--> statement-breakpoint
ALTER TABLE "qualified_leads" ALTER COLUMN "id" SET DEFAULT uuid_v7();--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "id" SET DEFAULT uuid_v7();--> statement-breakpoint
ALTER TABLE "scope_answers" ALTER COLUMN "id" SET DEFAULT uuid_v7();--> statement-breakpoint
ALTER TABLE "scope_assumptions" ALTER COLUMN "id" SET DEFAULT uuid_v7();--> statement-breakpoint
ALTER TABLE "scope_participants" ALTER COLUMN "id" SET DEFAULT uuid_v7();--> statement-breakpoint
ALTER TABLE "scope_sessions" ALTER COLUMN "id" SET DEFAULT uuid_v7();

-- Commercial/version history is append-only. Retention may delete old scope
-- records, but it must never rewrite a recorded quote or seller configuration.
CREATE OR REPLACE FUNCTION prevent_immutable_history_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% history is immutable', TG_TABLE_NAME USING ERRCODE = '23000';
END;
$$;--> statement-breakpoint

CREATE TRIGGER service_versions_immutable BEFORE UPDATE ON "service_versions"
  FOR EACH ROW EXECUTE FUNCTION prevent_immutable_history_update();--> statement-breakpoint
CREATE TRIGGER pricing_rule_sets_immutable BEFORE UPDATE ON "pricing_rule_sets"
  FOR EACH ROW EXECUTE FUNCTION prevent_immutable_history_update();--> statement-breakpoint
CREATE TRIGGER pricing_rules_immutable BEFORE UPDATE ON "pricing_rules"
  FOR EACH ROW EXECUTE FUNCTION prevent_immutable_history_update();--> statement-breakpoint
CREATE TRIGGER scope_fields_immutable BEFORE UPDATE ON "scope_fields"
  FOR EACH ROW EXECUTE FUNCTION prevent_immutable_history_update();--> statement-breakpoint
CREATE TRIGGER service_constraints_immutable BEFORE UPDATE ON "service_constraints"
  FOR EACH ROW EXECUTE FUNCTION prevent_immutable_history_update();--> statement-breakpoint
CREATE TRIGGER quotes_immutable BEFORE UPDATE ON "quotes"
  FOR EACH ROW EXECUTE FUNCTION prevent_immutable_history_update();

CREATE OR REPLACE FUNCTION prevent_append_only_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% records are append-only', TG_TABLE_NAME USING ERRCODE = '23000';
END;
$$;--> statement-breakpoint

CREATE TRIGGER agent_invocations_append_only BEFORE UPDATE ON "agent_invocations"
  FOR EACH ROW EXECUTE FUNCTION prevent_append_only_update();--> statement-breakpoint
CREATE TRIGGER qualified_leads_append_only BEFORE UPDATE ON "qualified_leads"
  FOR EACH ROW EXECUTE FUNCTION prevent_append_only_update();--> statement-breakpoint
CREATE TRIGGER bookings_append_only BEFORE UPDATE ON "bookings"
  FOR EACH ROW EXECUTE FUNCTION prevent_append_only_update();--> statement-breakpoint

-- Retention unlinks a deleted finalized scope from its audit history, but every
-- other audit-event rewrite is rejected.
CREATE OR REPLACE FUNCTION preserve_audit_event_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.scope_id IS NOT NULL
    AND NEW.scope_id IS NULL
    AND NEW.workspace_id IS NOT DISTINCT FROM OLD.workspace_id
    AND NEW.actor IS NOT DISTINCT FROM OLD.actor
    AND NEW.action IS NOT DISTINCT FROM OLD.action
    AND NEW.outcome IS NOT DISTINCT FROM OLD.outcome
    AND NEW.metadata IS NOT DISTINCT FROM OLD.metadata
    AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit events are append-only' USING ERRCODE = '23000';
END;
$$;--> statement-breakpoint
CREATE TRIGGER audit_events_append_only BEFORE UPDATE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION preserve_audit_event_history();
