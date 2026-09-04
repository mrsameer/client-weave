-- Server routes use service-role access. Direct clients are denied by default;
-- these policies admit only scope participants and matching active owners.
ALTER TABLE scope_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scope_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE scope_assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_offerings ENABLE ROW LEVEL SECURITY;

CREATE POLICY scope_participant_reads_scope ON scope_sessions FOR SELECT
  USING (EXISTS (SELECT 1 FROM scope_participants p WHERE p.scope_id = id AND p.revoked_at IS NULL));
CREATE POLICY scope_participant_reads_answers ON scope_answers FOR SELECT
  USING (EXISTS (SELECT 1 FROM scope_participants p WHERE p.scope_id = scope_answers.scope_id AND p.revoked_at IS NULL));
CREATE POLICY scope_participant_reads_assumptions ON scope_assumptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM scope_participants p WHERE p.scope_id = scope_assumptions.scope_id AND p.revoked_at IS NULL));
CREATE POLICY scope_participant_reads_quotes ON quotes FOR SELECT
  USING (EXISTS (SELECT 1 FROM scope_participants p WHERE p.scope_id = quotes.scope_id AND p.revoked_at IS NULL));

-- Application authentication maps auth.uid() to workspace_members.user_id.
CREATE POLICY owners_manage_services ON service_offerings FOR ALL
  USING (EXISTS (SELECT 1 FROM workspace_members m WHERE m.workspace_id = service_offerings.workspace_id AND m.user_id = auth.uid() AND m.role = 'OWNER'));
CREATE POLICY owners_manage_availability ON availability_slots FOR ALL
  USING (EXISTS (SELECT 1 FROM workspace_members m WHERE m.workspace_id = availability_slots.workspace_id AND m.user_id = auth.uid() AND m.role = 'OWNER'));
