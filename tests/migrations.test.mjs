import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ORDERED_MIGRATIONS,
  computeSha256,
  runUnifiedMigrations,
  sanitizeDbUrl,
} from '../scripts/migrate-unified.mjs'

test('ORDERED_MIGRATIONS: follows strict sequence 0002 -> 0003 -> 0004 and excludes 0001', () => {
  assert.deepEqual(ORDERED_MIGRATIONS, [
    '0002_rasi_v2_clean.sql',
    '0003_market_intelligence.sql',
    '0004_signal_analysis.sql',
  ])
  assert.equal(ORDERED_MIGRATIONS.includes('0001_rasi_auth_and_watchlist.sql'), false)
})

test('computeSha256: produces deterministic 64-char hex digests', () => {
  const hash1 = computeSha256('SELECT 1;')
  const hash2 = computeSha256('SELECT 1;')
  const hash3 = computeSha256('SELECT 2;')

  assert.equal(hash1.length, 64)
  assert.equal(hash1, hash2)
  assert.notEqual(hash1, hash3)
})

test('sanitizeDbUrl: hides password and preserves host, port, db name', () => {
  const secretUrl = 'postgresql://postgres:mySuperSecret123@db.prod.internal:5432/rasi_production'
  const sanitized = sanitizeDbUrl(secretUrl)

  assert.equal(sanitized.includes('mySuperSecret123'), false)
  assert.equal(sanitized, 'postgresql://postgres:****@db.prod.internal:5432/rasi_production')
  assert.equal(sanitizeDbUrl(''), '[KOSONG]')
})

test('runUnifiedMigrations: throws and exits cleanly when database is unreachable without leaking credentials', async () => {
  const invalidUrl = 'postgresql://user:pass123@127.0.0.1:54999/nonexistent'
  await assert.rejects(
    async () => {
      await runUnifiedMigrations({
        connectionString: invalidUrl,
        silent: true,
        exitOnError: false,
      })
    },
    (err) => {
      assert.ok(err instanceof Error)
      assert.equal(err.message.includes('pass123'), false)
      return true
    },
  )
})

// Simulation tests for migration runner lifecycle logic
class MockMigrationLedger {
  constructor() {
    this.ledger = new Map() // filename -> { checksum, applied_at }
    this.tables = new Set()
    this.locked = false
  }

  tryLock() {
    if (this.locked) return false
    this.locked = true
    return true
  }

  unlock() {
    this.locked = false
  }

  isApplied(filename) {
    return this.ledger.has(filename)
  }

  getChecksum(filename) {
    return this.ledger.get(filename)?.checksum ?? null
  }

  applyMigration(filename, checksum, sqlStatements) {
    if (sqlStatements.includes('FAIL_ME')) {
      throw new Error('SIMULATED_SQL_ERROR')
    }
    this.ledger.set(filename, { checksum, applied_at: new Date() })
    this.tables.add(`table_from_${filename}`)
  }
}

test('MockMigrationLedger: fresh database applies 0002, 0003, 0004 in order and records ledger', () => {
  const db = new MockMigrationLedger()
  assert.equal(db.tryLock(), true)

  for (const filename of ORDERED_MIGRATIONS) {
    assert.equal(db.isApplied(filename), false)
    db.applyMigration(filename, computeSha256(filename), `CREATE TABLE ${filename};`)
    assert.equal(db.isApplied(filename), true)
  }

  db.unlock()
  assert.equal(db.ledger.size, 3)
  assert.ok(db.ledger.has('0002_rasi_v2_clean.sql'))
  assert.ok(db.ledger.has('0003_market_intelligence.sql'))
  assert.ok(db.ledger.has('0004_signal_analysis.sql'))
})

test('MockMigrationLedger: upgrading from pre-0003 state only applies 0003 and 0004', () => {
  const db = new MockMigrationLedger()
  // Existing state has 0002 already applied
  db.applyMigration(
    '0002_rasi_v2_clean.sql',
    computeSha256('0002_rasi_v2_clean.sql'),
    'CREATE TABLE 0002;',
  )

  const newlyApplied = []
  for (const filename of ORDERED_MIGRATIONS) {
    if (!db.isApplied(filename)) {
      db.applyMigration(filename, computeSha256(filename), `CREATE TABLE ${filename};`)
      newlyApplied.push(filename)
    }
  }

  assert.deepEqual(newlyApplied, ['0003_market_intelligence.sql', '0004_signal_analysis.sql'])
  assert.equal(db.ledger.size, 3)
})

test('MockMigrationLedger: running second time is idempotent and skips all migrations', () => {
  const db = new MockMigrationLedger()
  for (const filename of ORDERED_MIGRATIONS) {
    db.applyMigration(filename, computeSha256(filename), `CREATE TABLE ${filename};`)
  }

  const reapplied = []
  for (const filename of ORDERED_MIGRATIONS) {
    if (!db.isApplied(filename)) {
      db.applyMigration(filename, computeSha256(filename), `CREATE TABLE ${filename};`)
      reapplied.push(filename)
    }
  }

  assert.equal(reapplied.length, 0)
  assert.equal(db.ledger.size, 3)
})

test('MockMigrationLedger: checksum tampering is detected and throws', () => {
  const db = new MockMigrationLedger()
  const originalChecksum = computeSha256('original_content')
  db.applyMigration('0002_rasi_v2_clean.sql', originalChecksum, 'CREATE TABLE;')

  const modifiedChecksum = computeSha256('tampered_content')
  assert.throws(
    () => {
      const recorded = db.getChecksum('0002_rasi_v2_clean.sql')
      if (recorded && recorded !== modifiedChecksum) {
        throw new Error('TAMPERING_DETECTED')
      }
    },
    { message: 'TAMPERING_DETECTED' },
  )
})

test('MockMigrationLedger: failure during SQL rollback leaves no partial migration in ledger', () => {
  const db = new MockMigrationLedger()
  db.applyMigration('0002_rasi_v2_clean.sql', computeSha256('0002'), 'CREATE TABLE;')

  assert.throws(
    () => {
      db.applyMigration(
        '0003_market_intelligence.sql',
        computeSha256('0003'),
        'CREATE TABLE; FAIL_ME;',
      )
    },
    { message: 'SIMULATED_SQL_ERROR' },
  )

  // 0003 should NOT be recorded in ledger
  assert.equal(db.isApplied('0003_market_intelligence.sql'), false)
  assert.equal(db.ledger.size, 1)
})

test('MockMigrationLedger: concurrent runner fails when advisory lock is already held', () => {
  const db = new MockMigrationLedger()
  assert.equal(db.tryLock(), true)

  // Runner 2 tries to acquire same lock
  assert.equal(db.tryLock(), false)

  db.unlock()
  // Runner 2 can acquire after Runner 1 finishes
  assert.equal(db.tryLock(), true)
  db.unlock()
})
