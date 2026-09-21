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

const connectionString = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL atau DATABASE_MIGRATION_URL belum diatur.')
  process.exit(1)
}

// Sanitize URL for logging (hide password)
const sanitizedUrl = connectionString.replace(/:([^:@]+)@/, ':****@')
console.log(`Menjalankan migrasi database ke: ${sanitizedUrl}`)

const migrationFile = path.join(rootDir, 'drizzle', '0002_rasi_v2_clean.sql')
if (!fs.existsSync(migrationFile)) {
  console.error(`❌ File migrasi tidak ditemukan: ${migrationFile}`)
  process.exit(1)
}

const sqlContent = fs.readFileSync(migrationFile, 'utf-8')

const sql = postgres(connectionString, {
  max: 1,
  prepare: false,
  connect_timeout: 10,
})

try {
  await sql.unsafe(sqlContent)
  console.log('✅ Migrasi skema RASI v2 berhasil diterapkan.')
  await sql.end()
  process.exit(0)
} catch (error) {
  console.error('❌ Migrasi gagal:', error.message)
  await sql.end({ timeout: 2 }).catch(() => {})
  process.exit(1)
}
