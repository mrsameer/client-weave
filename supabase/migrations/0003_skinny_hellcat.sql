CREATE INDEX "scope_participants_live_scope_idx" ON "scope_participants" USING btree ("scope_id") WHERE "scope_participants"."revoked_at" IS NULL;

-- Browser and owner access is enforced by the server-side scope/workspace guards.
-- Do not grant a table-wide participant policy here: a participant token is an
-- application capability, not a PostgreSQL session identity. Service-role server
-- connections bypass these defaults while direct database clients are denied.
ALTER TABLE "scope_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scope_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scope_assumptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quotes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "availability_slots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_offerings" ENABLE ROW LEVEL SECURITY;
