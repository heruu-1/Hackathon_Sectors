import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim()
        let val = trimmed.slice(eqIdx + 1).trim()
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1)
        }
        if (!process.env[key]) {
          process.env[key] = val
        }
      }
    }
  }
}

loadEnvFile(path.join(rootDir, '.env.local'))
loadEnvFile(path.join(rootDir, '.env'))

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('❌ DATABASE_URL belum diatur.')
  process.exit(1)
}

const sanitizedUrl = connectionString.replace(/:([^:@]+)@/, ':****@')
console.log(`Pemeriksaan read-only database: ${sanitizedUrl}`)

const REQUIRED_TABLES = [
  'user',
  'session',
  'account',
  'verification',
  'anomalies',
  'api_cache',
  'watchlist',
  'analysis_snapshots',
  'analysis_history',
  'conversations',
  'conversation_messages',
  'quota_buckets',
  'cache_leases',
  'request_keys',
]

const sql = postgres(connectionString, {
  prepare: false,
  connect_timeout: 5,
  connection: { statement_timeout: 5000 },
})

try {
  const rows = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `
  const existingTables = new Set(rows.map((r) => r.table_name))
  const missing = REQUIRED_TABLES.filter((t) => !existingTables.has(t))

  console.log(`Tabel ditemukan (${existingTables.size}): ${Array.from(existingTables).join(', ')}`)

  if (missing.length > 0) {
    console.error(`❌ Tabel yang belum ada: ${missing.join(', ')}`)
    await sql.end()
    process.exit(1)
  }

  console.log('✅ Seluruh tabel yang disyaratkan telah tersedia di database.')
  await sql.end()
  process.exit(0)
} catch (error) {
  console.error('❌ Koneksi database gagal:', error.message)
  await sql.end({ timeout: 2 }).catch(() => {})
  process.exit(1)
}
