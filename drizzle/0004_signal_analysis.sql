-- =============================================================================
-- Migration: 0004_signal_analysis.sql
-- Market Intelligence: Signal Contexts & Signal Analysis Runs
-- =============================================================================

CREATE TABLE IF NOT EXISTS "signal_contexts" (
  "id" text PRIMARY KEY NOT NULL,
  "ticker" varchar(10) NOT NULL,
  "signal_at" timestamp with time zone NOT NULL,
  "reference_price" double precision NOT NULL,
  "reference_price_at" timestamp with time zone NOT NULL,
  "rule_label" varchar(100) NOT NULL,
  "provenance" jsonb NOT NULL,
  "methodology_version" varchar(50) NOT NULL,
  "initial_risk_params" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "signal_contexts_ticker_idx" ON "signal_contexts" ("ticker");
CREATE INDEX IF NOT EXISTS "signal_contexts_ticker_signal_at_idx" ON "signal_contexts" ("ticker", "signal_at");

CREATE TABLE IF NOT EXISTS "signal_analysis_runs" (
  "id" serial PRIMARY KEY NOT NULL,
  "context_id" text NOT NULL REFERENCES "signal_contexts"("id") ON DELETE cascade,
  "as_of" timestamp with time zone NOT NULL,
  "methodology_version" varchar(50) NOT NULL,
  "config_hash" varchar(64) NOT NULL,
  "data_checksum" varchar(64) NOT NULL,
  "report" jsonb NOT NULL,
  "status" varchar(30) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "signal_analysis_runs_context_asof_version_confighash_unique"
  ON "signal_analysis_runs" ("context_id", "as_of", "methodology_version", "config_hash");

CREATE INDEX IF NOT EXISTS "signal_analysis_runs_context_id_idx"
  ON "signal_analysis_runs" ("context_id");
