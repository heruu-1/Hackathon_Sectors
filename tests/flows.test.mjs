import assert from 'node:assert/strict'
import test from 'node:test'

import { aggregateForeignFlow, analyzeBrokers } from '../domain/flows.ts'

test('aggregateForeignFlow calculates sums and persistence accurately', () => {
  const sessions = [
    { date: '2026-09-18', netForeign: 1000 },
    { date: '2026-09-19', netForeign: 2000 },
    { date: '2026-09-20', netForeign: -500 },
    { date: '2026-09-21', netForeign: 1500 },
    { date: '2026-09-22', netForeign: 3000 },
  ]

  const agg = aggregateForeignFlow(sessions)
  assert.equal(agg.netForeign1Session, 3000)
  assert.equal(agg.netForeign5Sessions, 7000)
  assert.equal(agg.netForeign20Sessions, null) // less than 20 sessions
  assert.equal(agg.buySessionsCount, 4)
  assert.equal(agg.sellSessionsCount, 1)
  assert.equal(agg.totalValidSessions, 5)
  assert.equal(agg.persistenceFraction, 0.8) // 4 / 5
})

test('analyzeBrokers computes top buyers, sellers, and concentration', () => {
  const raw = [
    { broker_code: 'YP', buy_volume: 1000, buy_value: 10000, sell_volume: 200, sell_value: 2000 },
    { broker_code: 'CC', buy_volume: 500, buy_value: 5000, sell_volume: 100, sell_value: 1000 },
    { broker_code: 'AK', buy_volume: 100, buy_value: 1000, sell_volume: 800, sell_value: 8000 },
    { broker_code: 'BK', buy_volume: 0, buy_value: 0, sell_volume: 500, sell_value: 5000 },
  ]

  const analysis = analyzeBrokers(raw)
  assert.equal(analysis.topBuyers.length, 2)
  assert.equal(analysis.topBuyers[0].brokerCode, 'YP')
  assert.equal(analysis.topBuyers[0].netValue, 8000)
  assert.equal(analysis.topBuyers[0].avgBuyPrice, 10)

  assert.equal(analysis.topSellers.length, 2)
  assert.equal(analysis.topSellers[0].brokerCode, 'AK') // -7000 net value

  assert.equal(analysis.totalBuyValue, 16000)
  assert.equal(analysis.totalSellValue, 16000)
  assert.equal(analysis.totalGrossValue, 32000)

  // Top 3 buyers = YP (10k) + CC (5k) + AK (1k) = 16k / 16k = 1.0
  assert.equal(analysis.concentration.top3BuyConcentration, 1.0)
})
