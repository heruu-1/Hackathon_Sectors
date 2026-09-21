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
try {
  const rows = await sql`SELECT cache_key, created_at, expires_at FROM api_cache`
  console.log('Total api_cache rows:', rows.length)
  for (const r of rows) {
    console.log('-', r.cache_key)
  }
} finally {
  await sql.end()
}
