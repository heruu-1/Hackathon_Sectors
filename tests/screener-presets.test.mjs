import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MANDATORY_SCREENER_PRESETS,
  generateSafeCsv,
  sanitizeCsvCell,
} from '../domain/screener-presets.ts'

test('MANDATORY_SCREENER_PRESETS includes all 7 required presets', () => {
  assert.equal(MANDATORY_SCREENER_PRESETS.length, 7)
  const ids = MANDATORY_SCREENER_PRESETS.map((p) => p.id)
  assert.ok(ids.includes('foreign_flow_5d'))
  assert.ok(ids.includes('undervalued_peers'))
  assert.ok(ids.includes('volume_spike'))
  assert.ok(ids.includes('strong_growth'))
  assert.ok(ids.includes('high_dividend'))
  assert.ok(ids.includes('value_trap_risk'))
  assert.ok(ids.includes('cash_flow_divergence'))
})

test('sanitizeCsvCell neutralizes formula injection attempts', () => {
  // Formula injection attempts with =, +, -, @
  assert.equal(sanitizeCsvCell('=1+1'), '"\'=1+1"')
  assert.equal(sanitizeCsvCell("+cmd|' /C calc'!A0"), "\"'+cmd|' /C calc'!A0\"")
  assert.equal(sanitizeCsvCell('-500'), '"\'-500"')
  assert.equal(sanitizeCsvCell('@SUM(A1:A10)'), '"\'@SUM(A1:A10)"')

  // Regular safe values
  assert.equal(sanitizeCsvCell('BBCA'), '"BBCA"')
  assert.equal(sanitizeCsvCell(10500), '"10500"')
  assert.equal(sanitizeCsvCell(null), '""')

  // Quotes escaping
  assert.equal(sanitizeCsvCell('Bank "BCA"'), '"Bank ""BCA"""')
})

test('generateSafeCsv produces valid sanitized CSV table', () => {
  const columns = [
    { key: 'ticker', header: 'Kode Saham' },
    { key: 'price', header: 'Harga' },
    { key: 'change', header: 'Perubahan' },
  ]

  const rows = [
    { ticker: 'BBCA', price: 10200, change: '+2.5%' },
    { ticker: 'BBRI', price: 4900, change: '-1.0%' },
  ]

  const csv = generateSafeCsv(columns, rows)
  assert.ok(csv.includes('"Kode Saham","Harga","Perubahan"'))
  // Check that +2.5% and -1.0% were escaped with single quote
  assert.ok(csv.includes('"\'+2.5%"'))
  assert.ok(csv.includes('"\'-1.0%"'))
})
