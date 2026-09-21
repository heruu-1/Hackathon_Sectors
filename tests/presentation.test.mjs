import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculatePriceSma20,
  formatCurrencyIdr,
  formatDateWib,
  formatPercentageChange,
  formatScore,
  getStatusLabel,
} from '../lib/presentation/stock.ts'

test('formatCurrencyIdr handles null, undefined, and numbers', () => {
  assert.equal(formatCurrencyIdr(null), '—')
  assert.equal(formatCurrencyIdr(undefined), '—')
  assert.equal(formatCurrencyIdr(10150), 'Rp 10.150')
  assert.equal(formatCurrencyIdr(0), 'Rp 0')
})

test('formatDateWib formats dates or returns fallback', () => {
  assert.equal(formatDateWib(null), 'Tanggal belum tersedia')
  assert.equal(formatDateWib(undefined), 'Tanggal belum tersedia')
  assert.ok(formatDateWib('2026-03-15').includes('2026'))
})

test('formatPercentageChange handles positive, negative, and null fractions', () => {
  const up = formatPercentageChange(0.025)
  assert.equal(up.text, '+2.50%')
  assert.equal(up.trend, 'up')

  const down = formatPercentageChange(-0.0125)
  assert.equal(down.text, '-1.25%')
  assert.equal(down.trend, 'down')

  const neutral = formatPercentageChange(0)
  assert.equal(neutral.text, '0.00%')
  assert.equal(neutral.trend, 'neutral')

  const nullVal = formatPercentageChange(null)
  assert.equal(nullVal.text, '0.00%')
  assert.equal(nullVal.trend, 'neutral')
})

test('formatScore handles null and finite numbers', () => {
  assert.equal(formatScore(null), 'Data belum cukup')
  assert.equal(formatScore(undefined), 'Data belum cukup')
  assert.equal(formatScore(75.4), '75/100')
  assert.equal(formatScore(100), '100/100')
})

test('getStatusLabel maps statuses to user-friendly labels and variants', () => {
  assert.deepEqual(getStatusLabel(null), { label: 'Data belum cukup', variant: 'insufficient' })
  assert.deepEqual(getStatusLabel('INSUFFICIENT_DATA'), {
    label: 'Data belum cukup',
    variant: 'insufficient',
  })
  assert.deepEqual(getStatusLabel('NORMAL'), { label: 'NORMAL', variant: 'normal' })
  assert.deepEqual(getStatusLabel('BIG_ACCUMULATION'), {
    label: 'BIG ACCUMULATION',
    variant: 'normal',
  })
  assert.deepEqual(getStatusLabel('CRITICAL'), { label: 'CRITICAL', variant: 'critical' })
  assert.deepEqual(getStatusLabel('WARNING'), { label: 'WARNING', variant: 'warning' })
})

test('calculatePriceSma20 returns all null if fewer than 21 sessions', () => {
  const rows = Array.from({ length: 15 }, (_, i) => ({
    symbol: 'BBCA',
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    close: 10000 + i * 100,
    volume: 50000,
  }))

  const sma = calculatePriceSma20(rows)
  assert.equal(sma.length, 15)
  assert.ok(sma.every((v) => v === null))
})

test('calculatePriceSma20 computes 20-period average for index >= 20', () => {
  // 25 rows with close price = 1000
  const rows = Array.from({ length: 25 }, (_, i) => ({
    symbol: 'BBCA',
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    close: 1000,
    volume: 50000,
  }))

  const sma = calculatePriceSma20(rows)
  assert.equal(sma.length, 25)
  // First 20 are null (indices 0..19)
  for (let i = 0; i < 20; i++) {
    assert.equal(sma[i], null)
  }
  // Index 20 onwards has average of prior 20 sessions (indices 0..19)
  assert.equal(sma[20], 1000)
  assert.equal(sma[24], 1000)
})
