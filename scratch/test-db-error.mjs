import { pgTable, text } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const sql = postgres('postgresql://rasi:rasi_secret@127.0.0.1:5433/rasi', { connect_timeout: 1 })
const db = drizzle(sql)

const testTable = pgTable('cache_leases', {
  cacheKey: text('cache_key').primaryKey(),
})

try {
  await db.select().from(testTable)
} catch (err) {
  console.log('--- Drizzle Error ---')
  console.log('err.name:', err.name)
  console.log('err.message:', err.message)
  console.log('err.cause:', err.cause?.message, err.cause?.code)
  console.log('err stringified:', String(err))
}
process.exit(0)
