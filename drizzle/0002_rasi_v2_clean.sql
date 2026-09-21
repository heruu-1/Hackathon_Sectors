-- RASI v2 complete schema migration.
-- Idempotent and safe for both completely empty databases and existing installations.

BEGIN;

-- 1. Better Auth tables
CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" boolean NOT NULL DEFAULT false,
  "image" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY,
  "expires_at" timestamp with time zone NOT NULL,
  "token" text NOT NULL UNIQUE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "session" ("user_id");

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp with time zone,
  "refresh_token_expires_at" timestamp with time zone,
  "scope" text,
  "password" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "account" ("user_id");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

-- 2. Legacy anomalies archive
CREATE TABLE IF NOT EXISTS "anomalies" (
  "id" serial PRIMARY KEY,
  "uma_id" varchar(50) NOT NULL,
  "ticker" varchar(10) NOT NULL,
  "name" varchar(255) NOT NULL,
  "risk" integer NOT NULL,
  "price" varchar(50) NOT NULL,
  "change" varchar(50) NOT NULL,
  "price_date" varchar(20),
  "raw_price" double precision,
  "raw_change" double precision,
  "volume_spike" varchar(50) NOT NULL,
  "volume_spike_ratio" varchar(50),
  "status" varchar(20) NOT NULL,
  "composite_score" integer,
  "reason" text NOT NULL,
  "bandarmology" jsonb,
  "catalyst_divergence" jsonb,
  "insider_movement" jsonb,
  "news_impact" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- 3. API Cache
CREATE TABLE IF NOT EXISTS "api_cache" (
  "id" serial PRIMARY KEY,
  "cache_key" varchar(255) NOT NULL UNIQUE,
  "data" jsonb NOT NULL,
  "metadata" jsonb,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- 4. Watchlist
CREATE TABLE IF NOT EXISTS "watchlist" (
  "id" serial PRIMARY KEY,
  "user_id" text REFERENCES "user"("id") ON DELETE CASCADE,
  "ticker" varchar(10) NOT NULL,
  "name" varchar(255) NOT NULL,
  "target_price" varchar(50),
  "target_price_num" double precision,
  "notes" text,
  "priority" varchar(20) NOT NULL DEFAULT 'MEDIUM',
  "status" varchar(30) NOT NULL DEFAULT 'WATCHING',
  "last_price" varchar(50),
  "numeric_price" double precision,
  "last_change" varchar(50),
  "numeric_change" double precision,
  "price_date" varchar(20),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE "watchlist" ADD COLUMN IF NOT EXISTS "user_id" text REFERENCES "user"("id") ON DELETE CASCADE;
ALTER TABLE "watchlist" ADD COLUMN IF NOT EXISTS "target_price_num" double precision;
ALTER TABLE "watchlist" ADD COLUMN IF NOT EXISTS "numeric_price" double precision;
ALTER TABLE "watchlist" ADD COLUMN IF NOT EXISTS "numeric_change" double precision;
ALTER TABLE "watchlist" ADD COLUMN IF NOT EXISTS "price_date" varchar(20);
CREATE UNIQUE INDEX IF NOT EXISTS "watchlist_user_ticker_unique" ON "watchlist" ("user_id", "ticker");

-- 5. Analysis Snapshots
CREATE TABLE IF NOT EXISTS "analysis_snapshots" (
  "id" text PRIMARY KEY,
  "ticker" varchar(10) NOT NULL,
  "company_name" varchar(255) NOT NULL,
  "schema_version" varchar(20) NOT NULL,
  "rule_version" varchar(20) NOT NULL,
  "price" double precision,
  "price_change_fraction" double precision,
  "price_date" varchar(20),
  "payload" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "analysis_snapshots_ticker_created_idx" ON "analysis_snapshots" ("ticker", "created_at" DESC);

-- 6. Analysis History
CREATE TABLE IF NOT EXISTS "analysis_history" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "snapshot_id" text NOT NULL REFERENCES "analysis_snapshots"("id") ON DELETE CASCADE,
  "ticker" varchar(10) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "analysis_history_user_snapshot_unique" ON "analysis_history" ("user_id", "snapshot_id");
CREATE INDEX IF NOT EXISTS "analysis_history_user_created_idx" ON "analysis_history" ("user_id", "created_at" DESC, "id");

-- 7. Conversations & Messages
CREATE TABLE IF NOT EXISTS "conversations" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "title" varchar(255) NOT NULL,
  "ticker" varchar(10),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "conversations_user_updated_idx" ON "conversations" ("user_id", "updated_at" DESC);

CREATE TABLE IF NOT EXISTS "conversation_messages" (
  "id" text PRIMARY KEY,
  "conversation_id" text NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "role" varchar(20) NOT NULL,
  "content" text NOT NULL,
  "analysis_source" varchar(20),
  "sources" jsonb,
  "proposed_action" jsonb,
  "snapshot_id" text REFERENCES "analysis_snapshots"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "conversation_messages_conv_created_idx" ON "conversation_messages" ("conversation_id", "created_at", "id");

-- 8. Quota Buckets
CREATE TABLE IF NOT EXISTS "quota_buckets" (
  "id" serial PRIMARY KEY,
  "subject" varchar(255) NOT NULL,
  "operation" varchar(50) NOT NULL,
  "window_start" timestamp with time zone NOT NULL,
  "count" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "quota_buckets_subject_op_window_unique" ON "quota_buckets" ("subject", "operation", "window_start");

-- 9. Cache Leases
CREATE TABLE IF NOT EXISTS "cache_leases" (
  "cache_key" varchar(255) PRIMARY KEY,
  "holder" varchar(100) NOT NULL,
  "acquired_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone NOT NULL
);

-- 10. Request Keys
CREATE TABLE IF NOT EXISTS "request_keys" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "operation" varchar(50) NOT NULL,
  "request_key" varchar(100) NOT NULL,
  "response_payload" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "request_keys_user_op_key_unique" ON "request_keys" ("user_id", "operation", "request_key");

COMMIT;
