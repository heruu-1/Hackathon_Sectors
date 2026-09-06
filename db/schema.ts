import { integer, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core'

export const anomalies = pgTable('anomalies', {
  id: serial('id').primaryKey(),
  umaId: varchar('uma_id', { length: 50 }).notNull(),
  ticker: varchar('ticker', { length: 10 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  risk: integer('risk').notNull(),
  price: varchar('price', { length: 50 }).notNull(),
  change: varchar('change', { length: 50 }).notNull(),
  volumeSpike: varchar('volume_spike', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(), // CRITICAL, HIGH, WARNING, NORMAL
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
