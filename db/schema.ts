import { integer, jsonb, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core'

export const anomalies = pgTable('anomalies', {
  id: serial('id').primaryKey(),
  umaId: varchar('uma_id', { length: 50 }).notNull(),
  ticker: varchar('ticker', { length: 10 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  risk: integer('risk').notNull(),
  price: varchar('price', { length: 50 }).notNull(),
  change: varchar('change', { length: 50 }).notNull(),
  volumeSpike: varchar('volume_spike', { length: 50 }).notNull(),
  volumeSpikeRatio: varchar('volume_spike_ratio', { length: 50 }),
  status: varchar('status', { length: 20 }).notNull(), // CRITICAL, HIGH, WARNING, NORMAL
  compositeScore: integer('composite_score'), // 0 - 100
  reason: text('reason').notNull(),
  bandarmology: jsonb('bandarmology'),
  catalystDivergence: jsonb('catalyst_divergence'),
  insiderMovement: jsonb('insider_movement'),
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

export const watchlist = pgTable('watchlist', {
  id: serial('id').primaryKey(),
  ticker: varchar('ticker', { length: 10 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  targetPrice: varchar('target_price', { length: 50 }),
  notes: text('notes'),
  priority: varchar('priority', { length: 20 }).default('MEDIUM').notNull(), // HIGH, MEDIUM, LOW
  status: varchar('status', { length: 30 }).default('WATCHING').notNull(), // WATCHING, ACCUMULATING, SLEEPING_GIANT, BOUGHT
  lastPrice: varchar('last_price', { length: 50 }),
  lastChange: varchar('last_change', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type WatchlistItem = typeof watchlist.$inferSelect
export type NewWatchlistItem = typeof watchlist.$inferInsert
