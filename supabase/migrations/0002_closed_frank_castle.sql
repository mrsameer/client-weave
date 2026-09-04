CREATE TABLE "public_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"request_count" integer NOT NULL CHECK ("request_count" >= 0),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public_rate_limits" ENABLE ROW LEVEL SECURITY;
