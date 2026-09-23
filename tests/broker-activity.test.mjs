import assert from 'node:assert/strict'
import test from 'node:test'

import { aggregateBrokerActivity, compareTwoBrokers } from '../domain/broker-activity.ts'

test('aggregateBrokerActivity computes totals, gross shares, and rankings', () => {
  const rawItems = [
    { symbol: 'BBCA', bval: 50_000_000_000, sval: 20_000_000_000, blot: 50_000, slot: 20_000 },
    { symbol: 'BBRI', bval: 10_000_000_000, sval: 40_000_000_000, blot: 20_000, slot: 80_000 },
    { symbol: 'BMRI', bval: 15_000_000_000, sval: 15_000_000_000, blot: 30_000, slot: 30_000 },
  ]

  const registry = {
    YP: { code: 'YP', name: 'Mirae Asset Sekuritas', is_foreign: true, cohort: 'retail' },
  }

  const result = aggregateBrokerActivity('YP', rawItems, registry, '2024-08-01', '2024-08-05')

  assert.equal(result.brokerCode, 'YP')
  assert.equal(result.brokerName, 'Mirae Asset Sekuritas')
  assert.equal(result.isForeign, true)
  assert.equal(result.totalBuyValue, 75_000_000_000)
  assert.equal(result.totalSellValue, 75_000_000_000)
  assert.equal(result.totalGrossValue, 150_000_000_000)
  assert.equal(result.totalNetValue, 0)

  // BBCA: bval 50M, sval 20M -> net +30M, gross 70M
  // grossShare = 70M / 150M = 46.67%
  assert.equal(result.topNetBuy.length, 1)
  assert.equal(result.topNetBuy[0].symbol, 'BBCA')
  assert.equal(result.topNetBuy[0].netValue, 30_000_000_000)
  assert.equal(result.topNetBuy[0].grossSharePct, 46.67)

  // BBRI: bval 10M, sval 40M -> net -30M, gross 50M
  assert.equal(result.topNetSell.length, 1)
  assert.equal(result.topNetSell[0].symbol, 'BBRI')
  assert.equal(result.topNetSell[0].netValue, -30_000_000_000)

  // Top gross order: BBCA (70M), BBRI (50M), BMRI (30M)
  assert.equal(result.topGross[0].symbol, 'BBCA')
  assert.equal(result.topGross[1].symbol, 'BBRI')
  assert.equal(result.topGross[2].symbol, 'BMRI')
})

test('compareTwoBrokers compares two brokers and identifies alignments', () => {
  const summaryA = {
    brokerCode: 'AK',
    brokerName: 'UBS Sekuritas',
    isForeign: true,
    periodStart: '2024-08-01',
    periodEnd: '2024-08-05',
    totalBuyValue: 100e9,
    totalSellValue: 50e9,
    totalNetValue: 50e9,
    totalGrossValue: 150e9,
    topNetBuy: [
      {
        symbol: 'BBCA',
        buyValue: 60e9,
        sellValue: 10e9,
        netValue: 50e9,
        grossValue: 70e9,
        grossSharePct: 46.7,
        buyLot: 0,
        sellLot: 0,
        netLot: 0,
      },
      {
        symbol: 'ASII',
        buyValue: 40e9,
        sellValue: 10e9,
        netValue: 30e9,
        grossValue: 50e9,
        grossSharePct: 33.3,
        buyLot: 0,
        sellLot: 0,
        netLot: 0,
      },
    ],
    topNetSell: [
      {
        symbol: 'TLKM',
        buyValue: 0,
        sellValue: 30e9,
        netValue: -30e9,
        grossValue: 30e9,
        grossSharePct: 20.0,
        buyLot: 0,
        sellLot: 0,
        netLot: 0,
      },
    ],
    topGross: [],
  }

  const summaryB = {
    brokerCode: 'ZP',
    brokerName: 'Maybank Sekuritas',
    isForeign: true,
    periodStart: '2024-08-01',
    periodEnd: '2024-08-05',
    totalBuyValue: 80e9,
    totalSellValue: 60e9,
    totalNetValue: 20e9,
    totalGrossValue: 140e9,
    topNetBuy: [
      {
        symbol: 'BBCA',
        buyValue: 50e9,
        sellValue: 20e9,
        netValue: 30e9,
        grossValue: 70e9,
        grossSharePct: 50.0,
        buyLot: 0,
        sellLot: 0,
        netLot: 0,
      },
      {
        symbol: 'TLKM',
        buyValue: 30e9,
        sellValue: 10e9,
        netValue: 20e9,
        grossValue: 40e9,
        grossSharePct: 28.6,
        buyLot: 0,
        sellLot: 0,
        netLot: 0,
      },
    ],
    topNetSell: [
      {
        symbol: 'ASII',
        buyValue: 0,
        sellValue: 30e9,
        netValue: -30e9,
        grossValue: 30e9,
        grossSharePct: 21.4,
        buyLot: 0,
        sellLot: 0,
        netLot: 0,
      },
    ],
    topGross: [],
  }

  const comparison = compareTwoBrokers(summaryA, summaryB)

  assert.equal(comparison.commonStocks.length, 3)

  const bbca = comparison.commonStocks.find((c) => c.symbol === 'BBCA')
  assert.equal(bbca?.alignment, 'AGREE_ACCUMULATION')

  const asii = comparison.commonStocks.find((c) => c.symbol === 'ASII')
  assert.equal(asii?.alignment, 'OPPOSING') // AK buy (+30M), ZP sell (-30M)

  const tlkm = comparison.commonStocks.find((c) => c.symbol === 'TLKM')
  assert.equal(tlkm?.alignment, 'OPPOSING') // AK sell (-30M), ZP buy (+20M)

  assert.ok(comparison.overallSummary.includes('Perbandingan AK vs ZP'))
})

test('fetchBrokerActivity parses nested data[].summary Sectors API response correctly', async () => {
  const { fetchBrokerActivity } = await import('../lib/server/providers/broker-activity.ts')

  const mockResponse = {
    broker_code: 'YP',
    start: '2026-09-09',
    end: '2026-09-22',
    data: [
      {
        date: '2026-09-09',
        summary: [
          {
            symbol: 'BBCA.JK',
            bval: 10_000_000_000,
            sval: 2_000_000_000,
            blot: 10_000,
            slot: 2_000,
            nval: 8_000_000_000,
          },
          {
            symbol: 'BBRI.JK',
            bval: 5_000_000_000,
            sval: 12_000_000_000,
            blot: 5_000,
            slot: 12_000,
            nval: -7_000_000_000,
          },
        ],
      },
    ],
  }

  const mockFetch = async () =>
    new Response(JSON.stringify(mockResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  const envelope = await fetchBrokerActivity(
    'YP',
    '2026-09-09',
    '2026-09-22',
    'dummy-key',
    mockFetch,
  )

  assert.equal(envelope.state, 'ready')
  assert.equal(envelope.data.length, 2)
  assert.equal(envelope.data[0].symbol, 'BBCA')
  assert.equal(envelope.data[0].bval, 10_000_000_000)
  assert.equal(envelope.data[0].sval, 2_000_000_000)
  assert.equal(envelope.data[0].net_val, 8_000_000_000)
  assert.equal(envelope.data[1].symbol, 'BBRI')
  assert.equal(envelope.data[1].net_val, -7_000_000_000)
})
