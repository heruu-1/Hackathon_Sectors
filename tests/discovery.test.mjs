import assert from 'node:assert/strict'
import test from 'node:test'

import { selectCandidates } from '../domain/discovery.ts'

test('selectCandidates selects 2 from each of the 4 sources deterministically', () => {
  const sources = {
    priceMovers: [
      { symbol: 'BBCA', absoluteChange: 0.08 },
      { symbol: 'BBRI', absoluteChange: 0.06 },
      { symbol: 'BMRI', absoluteChange: 0.04 },
    ],
    foreignFlowMovers: [
      { symbol: 'TLKM', absoluteFlow: 50000000000 },
      { symbol: 'ASII', absoluteFlow: 40000000000 },
      { symbol: 'UNTR', absoluteFlow: 30000000000 },
    ],
    publications: [
      { symbol: 'GOTO', timestamp: '2026-09-22T10:00:00Z' },
      { symbol: 'BUKA', timestamp: '2026-09-22T09:00:00Z' },
      { symbol: 'EMTK', timestamp: '2026-09-22T08:00:00Z' },
    ],
    fundamentalMovers: [
      { symbol: 'ICBP', score: 95 },
      { symbol: 'INDF', score: 90 },
      { symbol: 'MYOR', score: 85 },
    ],
  }

  const selected = selectCandidates(sources, 8)
  assert.equal(selected.length, 8)
  // Check that 2 from each were included:
  assert.ok(selected.includes('BBCA') && selected.includes('BBRI'))
  assert.ok(selected.includes('TLKM') && selected.includes('ASII'))
  assert.ok(selected.includes('GOTO') && selected.includes('BUKA'))
  assert.ok(selected.includes('ICBP') && selected.includes('INDF'))
})

test('selectCandidates deduplicates and rotates to fill slots when duplicate tickers appear', () => {
  const sources = {
    priceMovers: [
      { symbol: 'BBCA', absoluteChange: 0.08 },
      { symbol: 'BBRI', absoluteChange: 0.06 },
    ],
    foreignFlowMovers: [
      { symbol: 'BBCA', absoluteFlow: 50000000000 }, // duplicate
      { symbol: 'BBRI', absoluteFlow: 40000000000 }, // duplicate
      { symbol: 'TLKM', absoluteFlow: 30000000000 },
      { symbol: 'ASII', absoluteFlow: 20000000000 },
    ],
    publications: [
      { symbol: 'GOTO', timestamp: '2026-09-22T10:00:00Z' },
      { symbol: 'BUKA', timestamp: '2026-09-22T09:00:00Z' },
    ],
    fundamentalMovers: [
      { symbol: 'ICBP', score: 95 },
      { symbol: 'INDF', score: 90 },
    ],
  }

  const selected = selectCandidates(sources, 8)
  assert.equal(selected.length, 8)
  // Ensures no duplicates in selected
  assert.equal(new Set(selected).size, 8)
  // Flow list rotated and picked TLKM and ASII
  assert.ok(selected.includes('TLKM'))
  assert.ok(selected.includes('ASII'))
})
