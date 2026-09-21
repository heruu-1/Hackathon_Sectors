import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'

// Read .env.local
const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf8')
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=["']?([^"'\r\n]+)["']?/)
  if (match) {
    process.env[match[1]] = match[2]
  }
}

const sql = postgres(process.env.DATABASE_URL)

console.log('Checking database api_cache entries for daily prices...')
try {
  const rows = await sql`SELECT cache_key, expires_at, created_at, (data->>'data')::jsonb as inner_data FROM api_cache WHERE cache_key LIKE '%daily%'`
  console.log(`Found ${rows.length} cache entries matching %daily%:`)
  for (const r of rows) {
    const len = Array.isArray(r.inner_data) ? r.inner_data.length : 'unknown'
    console.log(`- Key: ${r.cache_key} | Items: ${len} | Expires: ${r.expires_at}`)
  }

  // Also check if any snapshot exists
  const snaps = await sql`SELECT ticker, created_at, (payload->'envelopes'->'daily'->>'data')::jsonb as daily_rows FROM analysis_snapshots ORDER BY created_at DESC LIMIT 5`
  console.log(`\nFound ${snaps.length} recent analysis snapshots:`)
  for (const s of snaps) {
    const len = Array.isArray(s.daily_rows) ? s.daily_rows.length : 'unknown'
    console.log(`- Ticker: ${s.ticker} | Daily rows: ${len} | Created: ${s.created_at}`)
  }

  // Clean old daily cache entries from api_cache so fresh 60-day data is fetched immediately
  console.log('\nClearing old daily cache entries from api_cache...')
  const deleted = await sql`DELETE FROM api_cache WHERE cache_key LIKE '%daily%'`
  console.log(`Deleted old daily cache entries successfully.`)

} catch (err) {
  console.error('DB error:', err.message)
} finally {
  await sql.end()
}
