-- Realtime publication is private and carries only a scope id plus revision.
-- Row-level scope authorization is checked before a client can subscribe.
CREATE INDEX scope_participants_live_scope_idx ON scope_participants (scope_id) WHERE revoked_at IS NULL;
