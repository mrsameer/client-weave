-- Deterministic MVP data. IDs are stable so automated journeys can reset safely.
INSERT INTO workspaces (id, name, timezone, retention_days) VALUES
  ('00000000-0000-7000-8000-000000000001', 'Northstar Studio', 'America/New_York', 365)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES
  ('00000000-0000-7000-8000-000000000011', '00000000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000012', 'OWNER')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO service_offerings (id, workspace_id, slug, active) VALUES
  ('00000000-0000-7000-8000-000000000101', '00000000-0000-7000-8000-000000000001', 'launch-website', true),
  ('00000000-0000-7000-8000-000000000102', '00000000-0000-7000-8000-000000000001', 'brand-sprint', true),
  ('00000000-0000-7000-8000-000000000103', '00000000-0000-7000-8000-000000000001', 'growth-retainer', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_versions (id, service_id, version, name, description, base_price_minor, currency, delivery_min_days, delivery_max_days, included_items) VALUES
  ('00000000-0000-7000-8000-000000000201', '00000000-0000-7000-8000-000000000101', 1, 'Launch Website', 'A focused marketing website for a new offer.', 750000, 'USD', 15, 25, '["Strategy workshop", "Design", "Responsive build"]'),
  ('00000000-0000-7000-8000-000000000202', '00000000-0000-7000-8000-000000000102', 1, 'Brand Sprint', 'Positioning and identity direction for growing teams.', 420000, 'USD', 10, 15, '["Positioning", "Identity direction", "Brand guide"]'),
  ('00000000-0000-7000-8000-000000000203', '00000000-0000-7000-8000-000000000103', 1, 'Growth Retainer', 'Ongoing design and optimization support.', 300000, 'USD', 7, 10, '["Monthly planning", "Design support", "Reporting"]')
ON CONFLICT (service_id, version) DO NOTHING;

UPDATE service_offerings SET active_version_id = CASE id
  WHEN '00000000-0000-7000-8000-000000000101' THEN '00000000-0000-7000-8000-000000000201'::uuid
  WHEN '00000000-0000-7000-8000-000000000102' THEN '00000000-0000-7000-8000-000000000202'::uuid
  WHEN '00000000-0000-7000-8000-000000000103' THEN '00000000-0000-7000-8000-000000000203'::uuid END
WHERE id IN ('00000000-0000-7000-8000-000000000101', '00000000-0000-7000-8000-000000000102', '00000000-0000-7000-8000-000000000103');

INSERT INTO scope_fields (id, service_version_id, key, definition, display_order) VALUES
  ('00000000-0000-7000-8000-000000000301', '00000000-0000-7000-8000-000000000201', 'pages', '{"type":"NUMBER","required":true,"min":1,"max":20,"priceAffecting":true}', 1),
  ('00000000-0000-7000-8000-000000000302', '00000000-0000-7000-8000-000000000201', 'cms', '{"type":"BOOLEAN","required":true,"priceAffecting":true}', 2)
ON CONFLICT (service_version_id, key) DO NOTHING;

INSERT INTO pricing_rule_sets (id, service_version_id, version, evaluator_version, content_hash) VALUES
  ('00000000-0000-7000-8000-000000000401', '00000000-0000-7000-8000-000000000201', 1, 'v1', 'seed-launch-website-v1'),
  ('00000000-0000-7000-8000-000000000402', '00000000-0000-7000-8000-000000000202', 1, 'v1', 'seed-brand-sprint-v1'),
  ('00000000-0000-7000-8000-000000000403', '00000000-0000-7000-8000-000000000203', 1, 'v1', 'seed-growth-retainer-v1')
ON CONFLICT (service_version_id, version) DO NOTHING;

INSERT INTO pricing_rules (id, rule_set_id, priority, definition) VALUES
  ('00000000-0000-7000-8000-000000000501', '00000000-0000-7000-8000-000000000401', 1, '{"kind":"BASE","label":"Base service","amountMinor":750000}'),
  ('00000000-0000-7000-8000-000000000502', '00000000-0000-7000-8000-000000000401', 2, '{"kind":"QUANTITY","label":"Additional pages","quantityField":"pages","amountMinor":35000}'),
  ('00000000-0000-7000-8000-000000000503', '00000000-0000-7000-8000-000000000401', 3, '{"kind":"ADDON","label":"CMS setup","amountMinor":85000}'),
  ('00000000-0000-7000-8000-000000000504', '00000000-0000-7000-8000-000000000401', 4, '{"kind":"CONDITIONAL","label":"Rush delivery","field":"rush","equals":true,"percentBasisPoints":2500}')
ON CONFLICT DO NOTHING;

INSERT INTO service_constraints (id, service_version_id, definition) VALUES
  ('00000000-0000-7000-8000-000000000601', '00000000-0000-7000-8000-000000000201', '{"type":"DELIVERY_MINIMUM","days":15,"message":"Launch Website requires at least 15 business days."}'),
  ('00000000-0000-7000-8000-000000000602', '00000000-0000-7000-8000-000000000201', '{"type":"INCOMPATIBLE_OPTIONS","fields":["cms","staticExport"],"message":"CMS and static export cannot be selected together."}')
ON CONFLICT DO NOTHING;

INSERT INTO availability_slots (id, workspace_id, starts_at, ends_at, status) VALUES
  ('00000000-0000-7000-8000-000000000701', '00000000-0000-7000-8000-000000000001', '2030-01-15T15:00:00Z', '2030-01-15T15:30:00Z', 'AVAILABLE'),
  ('00000000-0000-7000-8000-000000000702', '00000000-0000-7000-8000-000000000001', '2030-01-16T16:00:00Z', '2030-01-16T16:30:00Z', 'AVAILABLE')
ON CONFLICT DO NOTHING;
