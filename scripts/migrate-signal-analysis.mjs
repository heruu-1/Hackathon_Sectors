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
  console.error('Error: DATABASE_URL tidak ditemukan di environment.')
  process.exit(1)
}

const args = process.argv.slice(2)
const isCheckMode = args.includes('--check')

const sqlFile = path.join(rootDir, 'drizzle', '0004_signal_analysis.sql')
if (!fs.existsSync(sqlFile)) {
  console.error(`Error: File migrasi tidak ditemukan: ${sqlFile}`)
  process.exit(1)
}

const migrationSql = fs.readFileSync(sqlFile, 'utf-8')
const sql = postgres(dbUrl, { max: 1 })

async function run() {
  try {
    if (isCheckMode) {
      console.log('Memeriksa keberadaan tabel signal_contexts dan signal_analysis_runs...')
      const rows = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('signal_contexts', 'signal_analysis_runs')
      `
      const tableNames = rows.map((r) => r.table_name)
      const hasContexts = tableNames.includes('signal_contexts')
      const hasRuns = tableNames.includes('signal_analysis_runs')

      if (hasContexts && hasRuns) {
        console.log('✓ Tabel signal_contexts dan signal_analysis_runs telah terpasang.')
        process.exit(0)
      } else {
        console.error(
          `✗ Tabel migrasi belum lengkap. Ditemukan: ${tableNames.join(', ') || 'tidak ada'}. Menjalankan migrasi diperlukan.`,
        )
        process.exit(1)
      }
    }

    console.log('Menerapkan migrasi: 0004_signal_analysis.sql ...')
    await sql.unsafe(migrationSql)
    console.log('✓ Migrasi 0004_signal_analysis.sql berhasil diterapkan!')
    process.exit(0)
  } catch (err) {
    console.error('Kesalahan saat menjalankan migrasi:', err instanceof Error ? err.message : err)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

run()
