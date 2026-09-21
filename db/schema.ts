import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// 1. Better Auth tables (aligned with default drizzle adapter schema)
// ---------------------------------------------------------------------------
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    userIdIdx: index('session_user_id_idx').on(table.userId),
  }),
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('account_user_id_idx').on(table.userId),
  }),
)

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    identifierIdx: index('verification_identifier_idx').on(table.identifier),
  }),
)

// ---------------------------------------------------------------------------
// 2. Legacy anomalies table (kept as archive during migration)
// ---------------------------------------------------------------------------
export const anomalies = pgTable('anomalies', {
  id: serial('id').primaryKey(),
  umaId: varchar('uma_id', { length: 50 }).notNull(),
  ticker: varchar('ticker', { length: 10 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  risk: integer('risk').notNull(),
  price: varchar('price', { length: 50 }).notNull(),
  change: varchar('change', { length: 50 }).notNull(),
  priceDate: varchar('price_date', { length: 20 }),
  rawPrice: doublePrecision('raw_price'),
  rawChange: doublePrecision('raw_change'),
  volumeSpike: varchar('volume_spike', { length: 50 }).notNull(),
  volumeSpikeRatio: varchar('volume_spike_ratio', { length: 50 }),
  status: varchar('status', { length: 20 }).notNull(), // CRITICAL, HIGH, WARNING, NORMAL
  compositeScore: integer('composite_score'), // 0 - 100
  reason: text('reason').notNull(),
  bandarmology: jsonb('bandarmology'),
  catalystDivergence: jsonb('catalyst_divergence'),
  insiderMovement: jsonb('insider_movement'),
  newsImpact: jsonb('news_impact'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Anomaly = typeof anomalies.$inferSelect
export type NewAnomaly = typeof anomalies.$inferInsert

// ---------------------------------------------------------------------------
// 3. Persistent API Cache
// ---------------------------------------------------------------------------
export const apiCache = pgTable('api_cache', {
  id: serial('id').primaryKey(),
  cacheKey: varchar('cache_key', { length: 255 }).unique().notNull(),
  data: jsonb('data').notNull(),
  metadata: jsonb('metadata'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type ApiCache = typeof apiCache.$inferSelect

// ---------------------------------------------------------------------------
// 4. Watchlist (with user ownership and additive numeric columns)
// ---------------------------------------------------------------------------
export const watchlist = pgTable(
  'watchlist',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    ticker: varchar('ticker', { length: 10 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    targetPrice: varchar('target_price', { length: 50 }),
    targetPriceNum: doublePrecision('target_price_num'),
    notes: text('notes'),
    priority: varchar('priority', { length: 20 }).default('MEDIUM').notNull(), // HIGH, MEDIUM, LOW
    status: varchar('status', { length: 30 }).default('WATCHING').notNull(), // WATCHING, ACCUMULATING, SLEEPING_GIANT, BOUGHT
    lastPrice: varchar('last_price', { length: 50 }),
    numericPrice: doublePrecision('numeric_price'),
    lastChange: varchar('last_change', { length: 50 }),
    numericChange: doublePrecision('numeric_change'),
    priceDate: varchar('price_date', { length: 20 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userTickerUnique: uniqueIndex('watchlist_user_ticker_unique').on(table.userId, table.ticker),
  }),
)

export type WatchlistItem = typeof watchlist.$inferSelect
export type NewWatchlistItem = typeof watchlist.$inferInsert

// ---------------------------------------------------------------------------
// 5. Analysis Snapshots (Public market snapshots with strictly validated schema)
// ---------------------------------------------------------------------------
export const analysisSnapshots = pgTable(
  'analysis_snapshots',
  {
    id: text('id').primaryKey(), // UUID
    ticker: varchar('ticker', { length: 10 }).notNull(),
    companyName: varchar('company_name', { length: 255 }).notNull(),
    schemaVersion: varchar('schema_version', { length: 20 }).notNull(),
    ruleVersion: varchar('rule_version', { length: 20 }).notNull(),
    price: doublePrecision('price'),
    priceChangeFraction: doublePrecision('price_change_fraction'),
    priceDate: varchar('price_date', { length: 20 }),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tickerCreatedIdx: index('analysis_snapshots_ticker_created_idx').on(
      table.ticker,
      table.createdAt.desc(),
    ),
  }),
)

export type AnalysisSnapshotRow = typeof analysisSnapshots.$inferSelect
export type NewAnalysisSnapshotRow = typeof analysisSnapshots.$inferInsert

// ---------------------------------------------------------------------------
// 6. Analysis History (User personal history linking user -> snapshot)
// ---------------------------------------------------------------------------
export const analysisHistory = pgTable(
  'analysis_history',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    snapshotId: text('snapshot_id')
      .notNull()
      .references(() => analysisSnapshots.id, { onDelete: 'cascade' }),
    ticker: varchar('ticker', { length: 10 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userSnapshotUnique: uniqueIndex('analysis_history_user_snapshot_unique').on(
      table.userId,
      table.snapshotId,
    ),
    userCreatedIdx: index('analysis_history_user_created_idx').on(
      table.userId,
      table.createdAt.desc(),
      table.id,
    ),
  }),
)

export type AnalysisHistoryRow = typeof analysisHistory.$inferSelect

// ---------------------------------------------------------------------------
// 7. Conversations & Messages (Persistent assistant per user)
// ---------------------------------------------------------------------------
export const conversations = pgTable(
  'conversations',
  {
    id: text('id').primaryKey(), // UUID
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    ticker: varchar('ticker', { length: 10 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userUpdatedIdx: index('conversations_user_updated_idx').on(
      table.userId,
      table.updatedAt.desc(),
    ),
  }),
)

export type ConversationRow = typeof conversations.$inferSelect

export const conversationMessages = pgTable(
  'conversation_messages',
  {
    id: text('id').primaryKey(), // UUID
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull(), // 'user' | 'assistant'
    content: text('content').notNull(),
    analysisSource: varchar('analysis_source', { length: 20 }), // 'GEMINI' | 'RULE_BASED'
    sources: jsonb('sources'),
    proposedAction: jsonb('proposed_action'),
    snapshotId: text('snapshot_id').references(() => analysisSnapshots.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    convCreatedIdx: index('conversation_messages_conv_created_idx').on(
      table.conversationId,
      table.createdAt,
      table.id,
    ),
  }),
)

export type ConversationMessageRow = typeof conversationMessages.$inferSelect

// ---------------------------------------------------------------------------
// 8. Quota Buckets (Atomic rate limiting per subject, operation, window)
// ---------------------------------------------------------------------------
export const quotaBuckets = pgTable(
  'quota_buckets',
  {
    id: serial('id').primaryKey(),
    subject: varchar('subject', { length: 255 }).notNull(),
    operation: varchar('operation', { length: 50 }).notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').default(0).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    subjectOpWindowUnique: uniqueIndex('quota_buckets_subject_op_window_unique').on(
      table.subject,
      table.operation,
      table.windowStart,
    ),
  }),
)

export type QuotaBucketRow = typeof quotaBuckets.$inferSelect

// ---------------------------------------------------------------------------
// 9. Cache Leases (Prevent duplicate upstream calls across serverless instances)
// ---------------------------------------------------------------------------
export const cacheLeases = pgTable('cache_leases', {
  cacheKey: varchar('cache_key', { length: 255 }).primaryKey(),
  holder: varchar('holder', { length: 100 }).notNull(),
  acquiredAt: timestamp('acquired_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})

export type CacheLeaseRow = typeof cacheLeases.$inferSelect

// ---------------------------------------------------------------------------
// 10. Request Keys (Idempotency deduplication per user, op, request key)
// ---------------------------------------------------------------------------
export const requestKeys = pgTable(
  'request_keys',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    operation: varchar('operation', { length: 50 }).notNull(),
    requestKey: varchar('request_key', { length: 100 }).notNull(),
    responsePayload: jsonb('response_payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userOpKeyUnique: uniqueIndex('request_keys_user_op_key_unique').on(
      table.userId,
      table.operation,
      table.requestKey,
    ),
  }),
)

export type RequestKeyRow = typeof requestKeys.$inferSelect
