import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

function loadEnv(filePath) {
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

loadEnv(path.join(rootDir, '.env.local'))
loadEnv(path.join(rootDir, '.env'))

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.log('No DATABASE_URL found, skipping migration.')
  process.exit(0)
}

const sqlFile = path.join(rootDir, 'drizzle', '0003_market_intelligence.sql')
const migrationSql = fs.readFileSync(sqlFile, 'utf-8')

const sql = postgres(dbUrl, { max: 1 })

async function run() {
  try {
    console.log('Applying migration: 0003_market_intelligence.sql ...')
    await sql.unsafe(migrationSql)
    console.log('Migration applied successfully! All market intelligence tables exist.')
  } catch (err) {
    console.error('Migration error:', err)
  } finally {
    await sql.end()
  }
}

run()
