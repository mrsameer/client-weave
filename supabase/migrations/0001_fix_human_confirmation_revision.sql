ALTER TABLE "human_confirmations"
ALTER COLUMN "scope_revision" SET DATA TYPE integer USING "scope_revision"::integer;
