import assert from 'node:assert/strict'
import { test } from 'node:test'

import { analyzeBandarmology } from '../domain/bandarmology.ts'
import { detectCatalystDivergence } from '../domain/divergence.ts'
import { analyzeInsiderMovement } from '../domain/insider.ts'
import { computeCompositeScore, evaluateFundamentals } from '../domain/scoring.ts'
import { normalizeTicker } from '../domain/ticker.ts'
import { calculateVolumeSpike } from '../domain/volume.ts'

test('Volume Spike: requires at least 21 sessions and handles zero volume', () => {
  // 1 session: must NOT return NORMAL 1x
  const oneSession = [{ symbol: 'BBCA', date: '2026-09-01', close: 5000, volume: 10_000_000 }]
  const res1 = calculateVolumeSpike(oneSession)
  assert.equal(res1.status, 'UNKNOWN')
  assert.equal(res1.spikeRatio, null)
  assert.match(res1.formattedRatio, /belum cukup/)

  // 20 sessions: still not enough (needs 21: 20 prior + 1 current)
  const twentySessions = Array.from({ length: 20 }, (_, i) => ({
    symbol: 'BBCA',
    date: `2026-08-${String(i + 1).padStart(2, '0')}`,
    close: 5000,
    volume: 10_000_000,
  }))
  const res20 = calculateVolumeSpike(twentySessions)
  assert.equal(res20.status, 'UNKNOWN')
  assert.equal(res20.spikeRatio, null)

  // 21 sessions: 20 days @ 10M, today @ 30M -> 3.0x EXTREME
  const twentyOneSessions = [
    ...twentySessions,
    { symbol: 'BBCA', date: '2026-09-01', close: 5100, volume: 30_000_000 },
  ]
  const res21 = calculateVolumeSpike(twentyOneSessions)
  assert.equal(res21.status, 'EXTREME')
  assert.equal(res21.spikeRatio, 3.0)
  assert.equal(res21.formattedRatio, '3x')

  // 21 sessions with today volume 0: valid 0x, status LOW
  const zeroTodaySessions = [
    ...twentySessions,
    { symbol: 'BBCA', date: '2026-09-01', close: 5000, volume: 0 },
  ]
  const resZero = calculateVolumeSpike(zeroTodaySessions)
  assert.equal(resZero.status, 'LOW')
  assert.equal(resZero.spikeRatio, 0)
})

test('Insider Movement: preserves 2.56 as 2.56% (F06) and requires market price for discount dump', () => {
  const filings = [
    {
      timestamp: '2026-09-10T10:00:00',
      holder_name: 'Direktur Utama',
      transaction_type: 'sell',
      price: 3000,
      transaction_value: 12_000_000_000,
      share_percentage_transaction: 2.56, // 2.56 percentage points
    },
  ]

  // Without market price comparison: cannot flag STEEP_DISCOUNT_DUMP
  const resNoMarketPrice = analyzeInsiderMovement(filings, null)
  assert.notEqual(resNoMarketPrice.status, 'STEEP_DISCOUNT_DUMP')
  assert.equal(resNoMarketPrice.status, 'MASSIVE_DIVESTMENT')
  // Verifies 2.56% is NOT 256%
  assert.match(resNoMarketPrice.summary, /2\.56%/)
  assert.doesNotMatch(resNoMarketPrice.summary, /256/)

  // With market price comparison Rp 5000: discount = (5000 - 3000)/5000 = 40% >= 25% -> STEEP_DISCOUNT_DUMP
  const resWithMarketPrice = analyzeInsiderMovement(filings, 5000)
  assert.equal(resWithMarketPrice.status, 'STEEP_DISCOUNT_DUMP')
  assert.match(resWithMarketPrice.summary, /DISKON EKSTREM/)
})

test('Bandarmology: separates broker origin from foreign investor transactions (F07)', () => {
  const brokerRows = [
    // Foreign broker, but 0 foreign investor transactions
    {
      broker_code: 'AK',
      bval: 10_000_000_000,
      sval: 0,
      blot: 20_000,
      slot: 0,
      nval: 10_000_000_000,
      f_bval: 0,
      f_sval: 0,
    },
    // Domestic broker, but heavy foreign investor buy
    {
      broker_code: 'YP',
      bval: 5_000_000_000,
      sval: 0,
      blot: 10_000,
      slot: 0,
      nval: 5_000_000_000,
      f_bval: 5_000_000_000,
      f_sval: 0,
    },
  ]

  const registry = {
    AK: { code: 'AK', name: 'UBS Sekuritas', is_foreign: true, cohort: 'institutional' },
    YP: { code: 'YP', name: 'Mirae Asset', is_foreign: false, cohort: 'retail' },
  }

  const result = analyzeBandarmology(brokerRows, registry, 5000)
  // Foreign flow comes from f_bval (5M), NOT AK's 10M!
  assert.equal(result.foreignBuyVal, 5_000_000_000)
  assert.equal(result.netForeignVal, 5_000_000_000)
  assert.equal(result.foreignFlowStatus, 'INFLOW')

  // Top buyers metadata
  assert.equal(result.topBuyers[0].code, 'AK')
  assert.equal(result.topBuyers[0].isForeign, true)
})

test('Divergence: missing price response returns NO_PRICE_RESPONSE and null score (F08)', () => {
  const impact = {
    sentiment: 'BULLISH',
    impactScore: 80,
    catalystType: 'ACQUISITION',
    headlineId: 'Akuisisi Tambang Emas',
    summaryId: 'Perseroan mengakuisisi tambang emas.',
    isAiGenerated: false,
    analysisSource: 'RULE_BASED',
  }

  const resNullPrice = detectCatalystDivergence(impact, null)
  assert.equal(resNullPrice.status, 'NO_PRICE_RESPONSE')
  assert.equal(resNullPrice.divergenceScore, null)
  assert.match(resNullPrice.verdict, /penutupan pembanding belum tersedia/)

  const resSleepingGiant = detectCatalystDivergence(impact, 0.005) // +0.5% move
  assert.equal(resSleepingGiant.status, 'SLEEPING_GIANT')
  assert.ok(resSleepingGiant.divergenceScore >= 80)
})

test('Composite Scoring: strictly null when any pillar is incomplete (3.9)', () => {
  const completeFundamental = {
    dataState: 'ready',
    pe: 15,
    pb: 2,
    year: 2026,
    riskScore: 20,
    status: 'NORMAL',
    reason: 'Valuasi wajar',
  }
  const completeBandar = {
    dataState: 'ready',
    status: 'BIG_ACCUMULATION',
    bandarScore: 80,
    cr3Buy: 75,
    cr5Buy: 85,
    cr3Sell: 20,
    cr5Sell: 30,
    topBuyers: [],
    topSellers: [],
    foreignBuyVal: 10_000_000_000,
    foreignSellVal: 0,
    netForeignVal: 10_000_000_000,
    foreignFlowStatus: 'HEAVY_INFLOW',
    bandarAvgPrice: 5000,
    currentPrice: 5000,
    flowSummary: 'Akumulasi kuat',
    date: '2026-09-18',
  }
  const completeDivergence = {
    dataState: 'ready',
    status: 'SLEEPING_GIANT',
    divergenceScore: 85,
    priceChangePct: 0.5,
    headline: 'Berita',
    impactScore: 80,
    sentiment: 'BULLISH',
    catalystType: 'ACQUISITION',
    verdict: 'Sleeping giant',
    recommendation: 'Akumulasi',
  }
  const completeInsider = {
    dataState: 'ready',
    hasInsiderActivity: true,
    status: 'AGGRESSIVE_BUY',
    insiderRiskScore: 15,
    latestFiling: null,
    filingsCount: 1,
    summary: 'Beli',
  }

  // All 4 complete: score is computed
  const fullScore = computeCompositeScore({
    fundamental: completeFundamental,
    bandarmology: completeBandar,
    divergence: completeDivergence,
    insider: completeInsider,
  })
  assert.equal(fullScore.componentsComplete, true)
  assert.equal(typeof fullScore.score, 'number')

  // One pillar incomplete (e.g. divergence NO_PRICE_RESPONSE with score null)
  const incompleteDivergence = {
    ...completeDivergence,
    status: 'NO_PRICE_RESPONSE',
    divergenceScore: null,
  }
  const partialScore = computeCompositeScore({
    fundamental: completeFundamental,
    bandarmology: completeBandar,
    divergence: incompleteDivergence,
    insider: completeInsider,
  })
  assert.equal(partialScore.componentsComplete, false)
  assert.equal(partialScore.score, null)
  assert.equal(partialScore.status, 'INSUFFICIENT_DATA')
  assert.match(partialScore.reason, /Divergensi/)
})

test('Ticker normalization and fundamental evaluation', () => {
  assert.equal(normalizeTicker('bbca.jk'), 'BBCA')

  const val = evaluateFundamentals({
    symbol: 'BBCA',
    companyName: 'BCA',
    lastClosePrice: 6000,
    latestCloseDate: '2026-09-18',
    dailyCloseChange: 0.01,
    historicalValuation: [{ year: 2026, pe: 14, pb: 2.5 }],
  })
  assert.equal(val.dataState, 'ready')
  assert.equal(val.pe, 14)
  assert.equal(val.pb, 2.5)
  assert.equal(val.status, 'NORMAL')
})
