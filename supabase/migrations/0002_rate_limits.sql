CREATE TABLE public_rate_limits (
  key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public_rate_limits ENABLE ROW LEVEL SECURITY;
