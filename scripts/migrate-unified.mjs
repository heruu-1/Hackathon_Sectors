import crypto from 'node:crypto'
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

export const ORDERED_MIGRATIONS = [
  '0002_rasi_v2_clean.sql',
  '0003_market_intelligence.sql',
  '0004_signal_analysis.sql',
]

export function computeSha256(content) {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex')
}

export function sanitizeDbUrl(url) {
  if (!url) return '[KOSONG]'
  return url.replace(/:([^:@]+)@/, ':****@')
}

export async function runUnifiedMigrations(options = {}) {
  const isCheckMode = options.check ?? process.argv.includes('--check')
  const connectionString =
    options.connectionString ?? process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL

  if (!connectionString) {
    console.error('❌ Error: DATABASE_MIGRATION_URL atau DATABASE_URL belum dikonfigurasi.')
    if (options.exitOnError ?? true) process.exit(1)
    throw new Error('DATABASE_MIGRATION_URL atau DATABASE_URL belum dikonfigurasi.')
  }

  const sanitized = sanitizeDbUrl(connectionString)
  if (!options.silent) {
    console.log(`[Migrasi RASI] Target database: ${sanitized}`)
    if (isCheckMode) {
      console.log('[Migrasi RASI] Mode verifikasi (--check) aktif.')
    }
  }

  const sql = postgres(connectionString, {
    max: 1,
    connect_timeout: 10,
    idle_timeout: 5,
  })

  let lockAcquired = false

  try {
    // Verify connection
    await sql`SELECT 1`

    // Create migration ledger if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS "_rasi_migrations" (
        "id" serial PRIMARY KEY,
        "filename" varchar(255) NOT NULL UNIQUE,
        "checksum_sha256" varchar(64) NOT NULL,
        "applied_at" timestamp with time zone NOT NULL DEFAULT now()
      );
    `

    // In check mode: examine without advisory lock
    if (isCheckMode) {
      const appliedRows = await sql`
        SELECT filename, checksum_sha256, applied_at
        FROM "_rasi_migrations"
        ORDER BY id ASC
      `
      const appliedMap = new Map(appliedRows.map((r) => [r.filename, r.checksum_sha256]))

      const pending = []
      for (const filename of ORDERED_MIGRATIONS) {
        const filePath = path.join(rootDir, 'drizzle', filename)
        if (!fs.existsSync(filePath)) {
          throw new Error(`File migrasi tidak ditemukan di disk: ${filename}`)
        }
        const diskContent = fs.readFileSync(filePath, 'utf-8')
        const diskHash = computeSha256(diskContent)

        if (appliedMap.has(filename)) {
          const appliedHash = appliedMap.get(filename)
          if (appliedHash !== diskHash) {
            throw new Error(
              `TAMPERING_DETECTED: Checksum ${filename} berbeda! Di ledger: ${appliedHash}, di disk: ${diskHash}`,
            )
          }
        } else {
          pending.push(filename)
        }
      }

      if (pending.length > 0) {
        console.error(
          `❌ Check mode: Terdapat ${pending.length} migrasi tertunda: ${pending.join(', ')}`,
        )
        if (options.exitOnError ?? true) process.exit(1)
        return { success: false, pending }
      }

      if (!options.silent) {
        console.log(
          '✅ Check mode: Semua migrasi telah diterapkan secara lengkap dan checksum valid.',
        )
      }
      return { success: true, pending: [] }
    }

    // Acquire PostgreSQL advisory lock (key hash 'rasi_migration_lock')
    const [lockRes] =
      await sql`SELECT pg_try_advisory_lock(hashtext('rasi_migration_lock')) AS acquired`
    if (!lockRes.acquired) {
      throw new Error('LOCK_FAILED: Runner migrasi lain sedang aktif memegang advisory lock.')
    }
    lockAcquired = true

    // Fetch applied migrations
    const appliedRows = await sql`
      SELECT filename, checksum_sha256, applied_at
      FROM "_rasi_migrations"
      ORDER BY id ASC
    `
    const appliedMap = new Map(appliedRows.map((r) => [r.filename, r.checksum_sha256]))

    for (const filename of ORDERED_MIGRATIONS) {
      const filePath = path.join(rootDir, 'drizzle', filename)
      if (!fs.existsSync(filePath)) {
        throw new Error(`File migrasi tidak ditemukan: ${filePath}`)
      }
      const rawContent = fs.readFileSync(filePath, 'utf-8')
      const currentChecksum = computeSha256(rawContent)

      if (appliedMap.has(filename)) {
        const recordedChecksum = appliedMap.get(filename)
        if (recordedChecksum !== currentChecksum) {
          throw new Error(
            `TAMPERING_DETECTED: Checksum untuk migrasi terpasang '${filename}' tidak cocok! Ledger: ${recordedChecksum}, Disk: ${currentChecksum}. Menolak melanjutkan.`,
          )
        }
        if (!options.silent) {
          console.log(`  - [LEWATI] ${filename} (sudah diterapkan)`)
        }
        continue
      }

      if (!options.silent) {
        console.log(`  - [MENERAPKAN] ${filename} ...`)
      }

      // Strip outer BEGIN / COMMIT if file already has them to ensure clean transaction
      let sqlBody = rawContent
      const trimmedUpper = rawContent.trim().toUpperCase()
      if (trimmedUpper.startsWith('BEGIN;') && trimmedUpper.endsWith('COMMIT;')) {
        sqlBody = rawContent
          .trim()
          .replace(/^BEGIN;/i, '')
          .replace(/COMMIT;$/i, '')
      }

      // Execute inside atomic transaction
      await sql.begin(async (tx) => {
        await tx.unsafe(sqlBody)
        await tx`
          INSERT INTO "_rasi_migrations" (filename, checksum_sha256, applied_at)
          VALUES (${filename}, ${currentChecksum}, now())
        `
      })

      if (!options.silent) {
        console.log(`  ✓ [SUKSES] ${filename} berhasil diterapkan.`)
      }
    }

    if (!options.silent) {
      console.log('✅ Seluruh rantai migrasi berurutan berhasil diterapkan tanpa kesalahan.')
    }
    return { success: true }
  } catch (err) {
    console.error('❌ Kesalahan saat menjalankan migrasi:', err.message)
    if (options.exitOnError ?? true) {
      process.exit(1)
    }
    throw err
  } finally {
    if (lockAcquired) {
      await sql`SELECT pg_advisory_unlock(hashtext('rasi_migration_lock'))`.catch(() => {})
    }
    await sql.end({ timeout: 2 }).catch(() => {})
  }
}

// Direct invocation via CLI
const isDirectCli =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isDirectCli) {
  runUnifiedMigrations()
}
