import assert from 'node:assert/strict'
import { test } from 'node:test'

import { analyzeBandarmology, calculateVolumeSpike } from '../lib/bandarmology.ts'
import { detectCatalystDivergence } from '../lib/divergence.ts'
import { fallbackAnalyzeNews } from '../lib/gemini.ts'
import { analyzeInsiderMovement } from '../lib/insider.ts'
import { buildFullIntelligence } from '../lib/sectors.ts'

test('Bandarmology: detects BIG_ACCUMULATION when top 3 buyers strongly dominate', () => {
  const brokerRows = [
    { broker_code: 'AK', bval: 50_000_000_000, blot: 100_000, sval: 1_000_000_000, slot: 2_000 },
    { broker_code: 'BK', bval: 30_000_000_000, blot: 60_000, sval: 2_000_000_000, slot: 4_000 },
    { broker_code: 'CS', bval: 20_000_000_000, blot: 40_000, sval: 1_000_000_000, slot: 2_000 },
    { broker_code: 'YP', bval: 2_000_000_000, blot: 4_000, sval: 45_000_000_000, slot: 90_000 },
    { broker_code: 'XC', bval: 1_000_000_000, blot: 2_000, sval: 30_000_000_000, slot: 60_000 },
    { broker_code: 'PD', bval: 500_000_000, blot: 1_000, sval: 25_000_000_000, slot: 50_000 },
  ]
  const registry = {
    AK: { code: 'AK', name: 'UBS Sekuritas', is_foreign: true, cohort: 'institutional' },
    BK: { code: 'BK', name: 'JP Morgan', is_foreign: true, cohort: 'institutional' },
    CS: { code: 'CS', name: 'Credit Suisse', is_foreign: true, cohort: 'institutional' },
    YP: { code: 'YP', name: 'Mirae Asset', is_foreign: false, cohort: 'retail' },
    XC: { code: 'XC', name: 'Ajaib Sekuritas', is_foreign: false, cohort: 'retail' },
    PD: { code: 'PD', name: 'Indo Premier', is_foreign: false, cohort: 'retail' },
  }

  const result = analyzeBandarmology(brokerRows, registry, 5000, '2026-09-15')
  assert.equal(result.status, 'BIG_ACCUMULATION')
  assert.ok(result.cr3Buy > 70)
  assert.equal(result.foreignFlowStatus, 'HEAVY_INFLOW')
  assert.equal(result.topBuyers[0].code, 'AK')
  assert.equal(result.topSellers[0].code, 'YP')
  assert.ok(result.bandarAvgPrice > 0)
})

test('Bandarmology: detects BIG_DISTRIBUTION when heavy selling dumps onto market', () => {
  const brokerRows = [
    { broker_code: 'CC', bval: 1_000_000, blot: 2, sval: 50_000_000_000, slot: 100_000 },
    { broker_code: 'AK', bval: 1_000_000, blot: 2, sval: 40_000_000_000, slot: 80_000 },
    { broker_code: 'YP', bval: 10_000_000_000, blot: 20_000, sval: 1_000_000, slot: 2 },
    { broker_code: 'XC', bval: 10_000_000_000, blot: 20_000, sval: 1_000_000, slot: 2 },
    { broker_code: 'PD', bval: 10_000_000_000, blot: 20_000, sval: 1_000_000, slot: 2 },
    { broker_code: 'NI', bval: 10_000_000_000, blot: 20_000, sval: 1_000_000, slot: 2 },
    { broker_code: 'XL', bval: 10_000_000_000, blot: 20_000, sval: 1_000_000, slot: 2 },
    { broker_code: 'KK', bval: 10_000_000_000, blot: 20_000, sval: 1_000_000, slot: 2 },
    { broker_code: 'OD', bval: 10_000_000_000, blot: 20_000, sval: 1_000_000, slot: 2 },
  ]
  const result = analyzeBandarmology(brokerRows, {}, 5000)
  assert.equal(result.status, 'BIG_DISTRIBUTION')
  assert.ok(result.bandarScore < 40)
})

test('Volume Spike: detects EXTREME spike when today volume is > 2.5x SMA', () => {
  const dailyRows = [
    { symbol: 'BBCA', date: '2026-09-01', close: 6000, volume: 10_000_000 },
    { symbol: 'BBCA', date: '2026-09-02', close: 6050, volume: 10_000_000 },
    { symbol: 'BBCA', date: '2026-09-03', close: 6100, volume: 10_000_000 },
    { symbol: 'BBCA', date: '2026-09-04', close: 6200, volume: 30_000_000 }, // 3.0x
  ]
  const result = calculateVolumeSpike(dailyRows)
  assert.equal(result.status, 'EXTREME')
  assert.equal(result.spikeRatio, 3.0)
  assert.equal(result.formattedRatio, '3x')
})

test('Catalyst Divergence: identifies SLEEPING_GIANT when news is strong bullish but price has not moved', () => {
  const impact = {
    sentiment: 'BULLISH',
    impactScore: 80,
    catalystType: 'ACQUISITION',
    headlineId: 'Akuisisi Tambang Emas Jumbo Disetujui',
    summaryId: 'Perseroan resmi menuntaskan akuisisi bernilai Rp 5 Triliun.',
    isAiGenerated: false,
  }

  // Price changed only +0.5%
  const result = detectCatalystDivergence(impact, 0.005, '2026-09-15T14:30:00')
  assert.equal(result.status, 'SLEEPING_GIANT')
  assert.ok(result.divergenceScore >= 80)
  assert.match(result.verdict, /SLEEPING GIANT/)
})

test('Catalyst Divergence: identifies DELAYED_SELL_OFF_RISK when news is negative but price has not dropped', () => {
  const impact = {
    sentiment: 'BEARISH',
    impactScore: -75,
    catalystType: 'DEBT',
    headlineId: 'Gagal Bayar Bunga Obligasi',
    summaryId: 'Emiten mengumumkan gagal bayar obligasi jatuh tempo.',
    isAiGenerated: false,
  }

  // Price is still 0% flat
  const result = detectCatalystDivergence(impact, 0.0)
  assert.equal(result.status, 'DELAYED_SELL_OFF_RISK')
  assert.match(result.verdict, /DELAYED RISK/)
})

test('Catalyst Divergence: keeps an unavailable price response distinct from measured zero', () => {
  const impact = {
    sentiment: 'BULLISH',
    impactScore: 80,
    catalystType: 'EARNINGS',
    headlineId: 'Laba meningkat',
    summaryId: 'Ringkasan berita',
    isAiGenerated: false,
  }
  const result = detectCatalystDivergence(impact, null, '2026-09-16T09:00:00')
  assert.equal(result.status, 'NO_PRICE_RESPONSE')
  assert.match(result.verdict, /belum dapat dinilai/)
})

test('Gemini Fallback: parses bullish and bearish keywords correctly', () => {
  const bullish = fallbackAnalyzeNews(
    'Emiten Laba Melonjak 200% dan Siap Bagi Dividen Jumbo',
    'Kinerja perseroan mengalami pertumbuhan pesat.',
  )
  assert.equal(bullish.sentiment, 'BULLISH')
  assert.ok(bullish.impactScore > 0)

  const bearish = fallbackAnalyzeNews(
    'Gugatan Pailit Terhadap Entitas Anak dan Suspensi Perdagangan',
    'BEI melakukan suspensi karena investigasi gagal bayar utang.',
  )
  assert.equal(bearish.sentiment, 'BEARISH')
  assert.ok(bearish.impactScore < 0)
  assert.equal(bearish.analysisSource, 'RULE_BASED')
})

test('Insider Movement: flags STEEP_DISCOUNT_DUMP when selling at extreme discount', () => {
  const filings = [
    {
      title: 'Penjualan Saham Direksi',
      symbol: 'MAYA.JK',
      transaction_type: 'sell',
      holder_name: 'Jonathan Tahir',
      holder_type: 'insider',
      price: 10,
      amount_transaction: 500_000_000,
      transaction_value: 5_000_000_000,
      share_percentage_transaction: 0.02,
      timestamp: '2026-09-15T10:00:00',
    },
  ]

  // Current market price is Rp 300, sold at Rp 10 (96.7% discount!)
  const result = analyzeInsiderMovement(filings, 300)
  assert.equal(result.status, 'STEEP_DISCOUNT_DUMP')
  assert.equal(result.insiderRiskScore, 90)
  assert.match(result.summary, /DISKON EKSTREM/)
})

test('Full Intelligence: builds unified composite score and status', () => {
  const reportData = {
    symbol: 'BBCA.JK',
    company_name: 'PT Bank Central Asia Tbk.',
    valuation: {
      last_close_price: 6400,
      latest_close_date: '2026-09-15',
      daily_close_change: 0.01,
      historical_valuation: [{ year: 2026, pe: 14.5, pb: 2.9 }],
    },
  }
  const dailyRows = [
    { symbol: 'BBCA.JK', date: '2026-09-14', close: 6325, volume: 100_000_000 },
    { symbol: 'BBCA.JK', date: '2026-09-15', close: 6400, volume: 220_000_000 },
  ]
  const brokerData = {
    symbol: 'BBCA.JK',
    data: [
      {
        date: '2026-09-15',
        summary: [
          { broker_code: 'AK', bval: 10_000_000_000, blot: 20_000, sval: 1_000_000, slot: 2 },
          { broker_code: 'BK', bval: 8_000_000_000, blot: 16_000, sval: 1_000_000, slot: 2 },
          { broker_code: 'CS', bval: 6_000_000_000, blot: 12_000, sval: 1_000_000, slot: 2 },
          { broker_code: 'YP', bval: 1_000_000, blot: 2, sval: 20_000_000_000, slot: 40_000 },
        ],
      },
    ],
  }
  const brokerRegistry = {
    AK: { code: 'AK', name: 'UBS', is_foreign: true, cohort: 'institutional' },
    BK: { code: 'BK', name: 'JPM', is_foreign: true, cohort: 'institutional' },
    CS: { code: 'CS', name: 'CS', is_foreign: true, cohort: 'institutional' },
    YP: { code: 'YP', name: 'Mirae', is_foreign: false, cohort: 'retail' },
  }

  const result = buildFullIntelligence({
    ticker: 'BBCA',
    reportData,
    dailyRows,
    brokerData,
    brokerRegistry,
    newsItems: [],
    newsImpact: null,
    filings: [],
  })

  assert.equal(result.ticker, 'BBCA')
  assert.equal(result.price, 'Rp 6.400')
  assert.ok(result.volumeSpike.includes('x'))
  assert.equal(result.bandarmology.status, 'BIG_ACCUMULATION')
  assert.ok(result.compositeScore >= 0 && result.compositeScore <= 100)
})
