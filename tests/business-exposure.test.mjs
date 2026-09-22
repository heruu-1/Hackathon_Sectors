import assert from 'node:assert/strict'
import test from 'node:test'

import { analyzeBusinessExposure } from '../domain/business-exposure.ts'

test('analyzeBusinessExposure calculates concentration and verified commodities', () => {
  const rawSegments = [
    { name: 'Jasa Pertambangan', percentage: 10.5, value: 5e12 },
    { name: 'Penjualan Batubara', percentage: 85.0, value: 45e12 },
    { name: 'Lain-lain', percentage: 4.5, value: 2e12 },
  ]

  const result = analyzeBusinessExposure('ADRO', 'Adaro Energy Indonesia Tbk', rawSegments)

  assert.equal(result.symbol, 'ADRO')
  assert.equal(result.segments[0].name, 'Penjualan Batubara') // sorted descending
  assert.equal(result.largestSegment?.name, 'Penjualan Batubara')
  assert.equal(result.largestSegment?.percentage, 85.0)
  assert.equal(result.concentrationLevel, 'HIGH') // >= 70%

  // Commodity check
  assert.ok(result.commodityExposures.length > 0)
  assert.equal(result.commodityExposures[0].commodityName, 'Batubara')
  assert.equal(result.commodityExposures[0].verificationStatus, 'VERIFIED')
  assert.ok(result.summary.includes('Batubara'))
  assert.ok(result.summary.includes('tinggi'))
})

test('analyzeBusinessExposure handles multi-commodity and moderate concentration', () => {
  const rawSegments = [
    { name: 'Penjualan Emas', percentage: 55.0, value: 20e12 },
    { name: 'Feronikel', percentage: 30.0, value: 12e12 },
    { name: 'Bauksit & Alumina', percentage: 15.0, value: 6e12 },
  ]

  const result = analyzeBusinessExposure('ANTM', 'Aneka Tambang Tbk', rawSegments)

  assert.equal(result.concentrationLevel, 'MODERATE') // 55% is >= 40% and < 70%
  assert.equal(result.commodityExposures.length, 3) // Emas, Nikel, Bauksit
  const names = result.commodityExposures.map((c) => c.commodityName)
  assert.ok(names.includes('Emas'))
  assert.ok(names.includes('Nikel'))
  assert.ok(names.includes('Bauksit'))
})

test('analyzeBusinessExposure handles non-commodity and empty segments safely', () => {
  const result = analyzeBusinessExposure('BBCA', 'Bank Central Asia Tbk', [])
  assert.equal(result.concentrationLevel, 'UNKNOWN')
  assert.equal(result.commodityExposures.length, 0)
  assert.ok(result.summary.includes('belum tersedia'))
})
