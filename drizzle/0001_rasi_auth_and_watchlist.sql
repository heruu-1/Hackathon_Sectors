-- RASI account boundary and Better Auth OAuth storage.
-- Apply this migration to staging first. It is additive and keeps legacy
-- watchlist rows without an owner inaccessible to public account routes.
begin;

alter table if exists "anomalies" add column if not exists "news_impact" jsonb;
alter table if exists "anomalies" add column if not exists "price_date" varchar(20);
alter table if exists "anomalies" add column if not exists "raw_price" double precision;
alter table if exists "anomalies" add column if not exists "raw_change" double precision;

create table if not exists "user" (
  "id" text primary key,
  "name" text not null,
  "email" text not null unique,
  "email_verified" boolean not null default false,
  "image" text,
  "created_at" timestamp not null default now(),
  "updated_at" timestamp not null default now()
);

create table if not exists "session" (
  "id" text primary key,
  "expires_at" timestamp not null,
  "token" text not null unique,
  "created_at" timestamp not null default now(),
  "updated_at" timestamp not null default now(),
  "ip_address" text,
  "user_agent" text,
  "user_id" text not null references "user"("id") on delete cascade
);

create index if not exists "session_user_id_idx" on "session" ("user_id");

create table if not exists "account" (
  "id" text primary key,
  "account_id" text not null,
  "provider_id" text not null,
  "user_id" text not null references "user"("id") on delete cascade,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope" text,
  "password" text,
  "created_at" timestamp not null default now(),
  "updated_at" timestamp not null default now()
);

create index if not exists "account_user_id_idx" on "account" ("user_id");

create table if not exists "verification" (
  "id" text primary key,
  "identifier" text not null,
  "value" text not null,
  "expires_at" timestamp not null,
  "created_at" timestamp not null default now(),
  "updated_at" timestamp not null default now()
);

create index if not exists "verification_identifier_idx" on "verification" ("identifier");

alter table "watchlist" add column if not exists "user_id" text;
alter table "watchlist"
  add constraint "watchlist_user_id_user_id_fk"
  foreign key ("user_id") references "user"("id") on delete cascade;

alter table "watchlist" drop constraint if exists "watchlist_ticker_unique";
create unique index if not exists "watchlist_user_ticker_unique"
  on "watchlist" ("user_id", "ticker");

commit;
