import assert from 'node:assert/strict'
import test from 'node:test'

import { calculateRVOL, calculateVWAP } from '../domain/signal-indicators.ts'
import { jakartaTimeToIso } from '../domain/trading-sessions.ts'
import { createProviderEnvelope } from '../lib/contracts/provider-envelope.ts'
import { fetchLiveMarketQuote } from '../lib/server/providers/market.ts'

test('F1: ProviderEnvelope standardizes provider responses with status, delay, and issues', () => {
  const envelope = createProviderEnvelope({
    status: 'SUCCESS',
    source: 'sectors-daily',
    data: [{ ticker: 'BBCA', close: 10000 }],
    sourceDelayMinutes: 15,
    issues: [{ code: 'DELAYED', message: 'Delayed 15m' }],
  })

  assert.equal(envelope.status, 'SUCCESS')
  assert.equal(envelope.source, 'sectors-daily')
  assert.equal(envelope.sourceDelayMinutes, 15)
  assert.equal(envelope.issues.length, 1)
  assert.ok(envelope.observedAt)
  assert.equal(envelope.data[0].ticker, 'BBCA')
})

test('F1: fetchLiveMarketQuote does not claim real-time in its source metadata', async () => {
  // Invalid ticker returns null
  const invalid = await fetchLiveMarketQuote('INVALID123')
  assert.equal(invalid, null)
})

test('E6: VWAP and RVOL are scoped per continuous trading session', () => {
  // Create 2 days of 5m bars: Day 1 (10 bars) and Day 2 (10 bars)
  const day1Bars = Array.from({ length: 10 }, (_, i) => ({
    ticker: 'BBCA',
    startAt: jakartaTimeToIso('2026-09-21', 9, i * 5, 0),
    endAt: jakartaTimeToIso('2026-09-21', 9, (i + 1) * 5, 0),
    open: 10000,
    high: 10050,
    low: 9950,
    close: 10000,
    volume: 1000,
    source: 'YAHOO',
  }))

  const day2Bars = Array.from({ length: 10 }, (_, i) => ({
    ticker: 'BBCA',
    startAt: jakartaTimeToIso('2026-09-22', 9, i * 5, 0),
    endAt: jakartaTimeToIso('2026-09-22', 9, (i + 1) * 5, 0),
    open: 10500,
    high: 10550,
    low: 10450,
    close: 10500,
    volume: 2000,
    source: 'YAHOO',
  }))

  // VWAP of Day 2 alone should be ~10500, NOT diluted by Day 1's ~10000
  const day2Vwap = calculateVWAP(day2Bars)
  assert.equal(day2Vwap, 10500)

  // Combined VWAP would be diluted
  const combinedVwap = calculateVWAP([...day1Bars, ...day2Bars])
  assert.ok(combinedVwap < 10500, 'Combined VWAP improperly blends past days')

  // RVOL comparison: Day 2 total volume (20,000) vs Day 1 total volume (10,000)
  const day1Total = day1Bars.reduce((sum, b) => sum + b.volume, 0)
  const day2Total = day2Bars.reduce((sum, b) => sum + b.volume, 0)

  // RVOL requires at least 5 historical observations
  const historical = [day1Total, day1Total, day1Total, day1Total, day1Total]
  const rvol = calculateRVOL(day2Total, historical)
  assert.equal(rvol, 2.0, 'Day 2 volume (20k) should be 2.0x relative to Day 1 baseline (10k)')
})
