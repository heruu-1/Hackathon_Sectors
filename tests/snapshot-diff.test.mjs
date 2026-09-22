import assert from 'node:assert/strict'
import test from 'node:test'

import {
  diffSnapshots,
  generateAssistantSnapshotContext,
  generateSnapshotMarkdown,
} from '../domain/snapshot-diff.ts'

function createMockSnapshot(overrides = {}) {
  return {
    id: 'snap-1',
    schemaVersion: '1.0.0',
    ruleVersion: 'rasi-mi-v2',
    ticker: 'BBCA',
    companyName: 'Bank Central Asia Tbk',
    createdAt: '2024-08-01T10:00:00Z',
    price: 10000,
    priceChangeFraction: 0.02,
    priceDate: '2024-08-01',
    composite: {
      score: 75,
      status: 'NORMAL',
      reason: 'Kondisi transaksi dan fundamental positif.',
    },
    indicators: {
      fundamental: { status: 'WARNING', reason: 'P/E tinggi', pe: 25.0, pb: 4.5 },
      bandarmology: { status: 'BIG_ACCUMULATION', flowSummary: 'Net buy masif', cr3Buy: 65.0 },
      divergence: { status: 'SLEEPING_GIANT', verdict: 'Katalis kuat', sentiment: 'BULLISH' },
      volume: { status: 'NORMAL', formattedRatio: '1.2x' },
      insider: { status: 'ROUTINE_TRANSACTION' },
    },
    ...overrides,
  }
}

test('diffSnapshots calculates price, score, and rule differences', () => {
  const s1 = createMockSnapshot({
    createdAt: '2024-08-01T10:00:00Z',
    price: 10000,
    priceDate: '2024-08-01',
    composite: { score: 70, status: 'NORMAL', reason: 'Cukup' },
    indicators: {
      fundamental: { status: 'WARNING', pe: 20, pb: 3 },
      bandarmology: { status: 'NEUTRAL', flowSummary: 'Netral' },
      divergence: { status: 'NORMAL_REACTION', verdict: 'Wajar' },
      volume: { status: 'NORMAL', formattedRatio: '1.1x' },
      insider: { status: 'NO_RECENT_FILINGS' },
    },
  })

  const s2 = createMockSnapshot({
    createdAt: '2024-08-05T10:00:00Z',
    price: 10500,
    priceDate: '2024-08-05',
    composite: { score: 85, status: 'NORMAL', reason: 'Kuat' },
    indicators: {
      fundamental: { status: 'WARNING', pe: 20, pb: 3 },
      bandarmology: { status: 'BIG_ACCUMULATION', flowSummary: 'Akumulasi' }, // newly triggered
      divergence: { status: 'NORMAL_REACTION', verdict: 'Wajar' },
      volume: { status: 'HIGH', formattedRatio: '2.5x' }, // newly triggered
      insider: { status: 'NO_RECENT_FILINGS' },
    },
  })

  const diff = diffSnapshots(s1, s2)
  assert.equal(diff.ticker, 'BBCA')
  assert.equal(diff.priceDiff.nominalChange, 500)
  assert.equal(diff.priceDiff.percentageChange, 5.0)
  assert.equal(diff.scoreDiff.delta, 15)
  assert.ok(diff.rulesChanges.newlyTriggered.includes('R04: Volume Spike'))
  assert.ok(diff.rulesChanges.newlyTriggered.includes('Transaksi: BIG_ACCUMULATION'))
  assert.ok(diff.rulesChanges.persistent.includes('Fundamental: WARNING'))
  assert.ok(diff.summary.includes('+5%'))
  assert.ok(diff.summary.includes('+15 poin'))
})

test('generateSnapshotMarkdown produces formatted document with thesis and invalidation', () => {
  const s = createMockSnapshot()
  const md = generateSnapshotMarkdown(
    s,
    'Tesis: Pertumbuhan laba perbankan tetap solid.',
    'Pembatalan: Jika NPL melonjak di atas 3% atau asing net sell 5 hari berturut-turut.',
  )

  assert.ok(md.includes('# Brief Riset Pasar: BBCA'))
  assert.ok(md.includes('Tesis: Pertumbuhan laba perbankan tetap solid.'))
  assert.ok(md.includes('Pembatalan: Jika NPL melonjak'))
  assert.ok(md.includes('Skor Komposit: 75 / 100'))
})

test('generateAssistantSnapshotContext generates compact context', () => {
  const s = createMockSnapshot()
  const ctx = generateAssistantSnapshotContext(s)
  assert.ok(ctx.includes('[KONTEKS SNAPSHOT RISET TERVERIFIKASI RASI]'))
  assert.ok(ctx.includes('BBCA'))
  assert.ok(ctx.includes('75/100'))
})
