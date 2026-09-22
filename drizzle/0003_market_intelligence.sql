-- Market Intelligence Tables Migration (Additive)
BEGIN;

-- 11. API Budgets & API Usage
CREATE TABLE IF NOT EXISTS "api_budgets" (
  "campaign" varchar(50) PRIMARY KEY,
  "total_limit" integer NOT NULL DEFAULT 500,
  "used_credits" integer NOT NULL DEFAULT 0,
  "reserved_credits" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "api_usage" (
  "id" serial PRIMARY KEY,
  "request_id" varchar(100) NOT NULL UNIQUE,
  "capability" varchar(100) NOT NULL,
  "credits_reserved" integer NOT NULL,
  "credits_used" integer NOT NULL DEFAULT 0,
  "status" varchar(50) NOT NULL,
  "endpoint" text NOT NULL,
  "status_code" integer,
  "duration_ms" integer,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "api_usage_request_id_idx" ON "api_usage" ("request_id");
CREATE INDEX IF NOT EXISTS "api_usage_status_idx" ON "api_usage" ("status");

-- 12. Market Scans & Research Snapshots
CREATE TABLE IF NOT EXISTS "market_scans" (
  "id" text PRIMARY KEY,
  "market_cutoff_date" varchar(20) NOT NULL,
  "universe_coverage" jsonb,
  "discovery_sources" jsonb,
  "candidate_tickers" jsonb NOT NULL,
  "snapshot_ids" jsonb NOT NULL,
  "pagination_status" jsonb,
  "status" varchar(20) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "market_scans_cutoff_idx" ON "market_scans" ("market_cutoff_date");

CREATE TABLE IF NOT EXISTS "research_snapshots" (
  "id" text PRIMARY KEY,
  "ticker" varchar(10) NOT NULL,
  "company_name" varchar(255),
  "schema_version" varchar(20) NOT NULL,
  "rule_version" varchar(20) NOT NULL,
  "market_cutoff_date" varchar(20) NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "research_snapshots_ticker_cutoff_idx" ON "research_snapshots" ("ticker", "market_cutoff_date");

-- 13. Research Notes
CREATE TABLE IF NOT EXISTS "research_notes" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "snapshot_id" text NOT NULL REFERENCES "research_snapshots"("id") ON DELETE CASCADE,
  "ticker" varchar(10) NOT NULL,
  "thesis" text NOT NULL,
  "invalidation_triggers" text,
  "watch_metrics" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "research_notes_user_snapshot_unique" ON "research_notes" ("user_id", "snapshot_id");
CREATE INDEX IF NOT EXISTS "research_notes_user_ticker_idx" ON "research_notes" ("user_id", "ticker");

-- 14. Saved Screens
CREATE TABLE IF NOT EXISTS "saved_screens" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "title" varchar(255) NOT NULL,
  "preset_id" varchar(100),
  "filters" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "saved_screens_user_idx" ON "saved_screens" ("user_id");

-- 15. Signal Outcomes
CREATE TABLE IF NOT EXISTS "signal_outcomes" (
  "id" serial PRIMARY KEY,
  "snapshot_id" text NOT NULL REFERENCES "research_snapshots"("id") ON DELETE CASCADE,
  "rule_id" varchar(50) NOT NULL,
  "rule_version" varchar(20) NOT NULL,
  "ticker" varchar(10) NOT NULL,
  "horizon" integer NOT NULL,
  "signal_date" varchar(20) NOT NULL,
  "target_date" varchar(20),
  "initial_price" double precision,
  "target_price" double precision,
  "return_fraction" double precision,
  "status" varchar(40) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "signal_outcomes_snapshot_rule_horizon_version_unique" ON "signal_outcomes" ("snapshot_id", "rule_id", "horizon", "rule_version");

COMMIT;
