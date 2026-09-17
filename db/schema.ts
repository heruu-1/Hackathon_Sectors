import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

// Better Auth tables. Keep these names aligned with the default adapter schema
// so OAuth sessions can be migrated with the generated Drizzle migration.
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

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

export const apiCache = pgTable('api_cache', {
  id: serial('id').primaryKey(),
  cacheKey: varchar('cache_key', { length: 255 }).unique().notNull(),
  data: jsonb('data').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type ApiCache = typeof apiCache.$inferSelect

export const watchlist = pgTable(
  'watchlist',
  {
    id: serial('id').primaryKey(),
    // Nullable keeps legacy rows readable while new writes always use a session owner.
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    ticker: varchar('ticker', { length: 10 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    targetPrice: varchar('target_price', { length: 50 }),
    notes: text('notes'),
    priority: varchar('priority', { length: 20 }).default('MEDIUM').notNull(), // HIGH, MEDIUM, LOW
    status: varchar('status', { length: 30 }).default('WATCHING').notNull(), // WATCHING, ACCUMULATING, SLEEPING_GIANT, BOUGHT
    lastPrice: varchar('last_price', { length: 50 }),
    lastChange: varchar('last_change', { length: 50 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userTickerUnique: uniqueIndex('watchlist_user_ticker_unique').on(table.userId, table.ticker),
  }),
)

export type WatchlistItem = typeof watchlist.$inferSelect
export type NewWatchlistItem = typeof watchlist.$inferInsert
