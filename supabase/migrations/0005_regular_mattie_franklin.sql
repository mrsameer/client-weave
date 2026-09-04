ALTER TABLE "scope_sessions" ADD COLUMN "goal_updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "scope_sessions" ADD COLUMN "budget_updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "scope_sessions" ADD COLUMN "delivery_updated_at" timestamp with time zone DEFAULT now() NOT NULL;