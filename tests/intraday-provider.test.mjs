import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeYahooTicker, parseYahooChartResponse } from '../lib/server/providers/intraday.ts'

test('normalizeYahooTicker handles casing and .JK suffix', () => {
  assert.equal(normalizeYahooTicker('bmri'), 'BMRI.JK')
  assert.equal(normalizeYahooTicker('BBCA.JK'), 'BBCA.JK')
  assert.equal(normalizeYahooTicker('  asii  '), 'ASII.JK')
  assert.equal(normalizeYahooTicker('TLKM.jk'), 'TLKM.JK')
})

test('parseYahooChartResponse processes valid 5m bars in continuous trading', () => {
  // Monday 2026-09-21
  // 09:00 WIB = 02:00 UTC = 1790042400 (example timestamp)
  // Let's create timestamps for Monday 2026-09-21:
  // 2026-09-21 09:00:00 WIB is 2026-09-21T02:00:00Z
  const baseTs = Math.floor(new Date('2026-09-21T02:00:00Z').getTime() / 1000)

  const mockResponse = {
    chart: {
      result: [
        {
          meta: {
            symbol: 'BMRI.JK',
            exchangeTimezoneName: 'Asia/Jakarta',
          },
          timestamp: [
            baseTs, // 09:00 WIB (S1 valid)
            baseTs + 300, // 09:05 WIB (S1 valid)
            baseTs + 600, // 09:10 WIB (null bar)
            baseTs + 900, // 09:15 WIB (S1 valid)
          ],
          indicators: {
            quote: [
              {
                open: [4200, 4210, null, 4220],
                high: [4220, 4230, null, 4240],
                low: [4190, 4200, null, 4210],
                close: [4210, 4220, null, 4230],
                volume: [100000, 150000, null, 120000],
              },
            ],
          },
        },
      ],
    },
  }

  const parsed = parseYahooChartResponse(mockResponse, 'BMRI')
  assert.equal(parsed.success, true)
  assert.ok(parsed.data)
  assert.equal(parsed.data.totalRawBars, 4)
  assert.equal(parsed.data.validBars, 3)
  assert.equal(parsed.data.nullBars, 1)
  assert.equal(parsed.data.bars.length, 3)
  assert.equal(parsed.data.delayMinutes, 10)
  assert.ok(parsed.data.checksum.length > 0)

  // Verify first bar
  const first = parsed.data.bars[0]
  assert.equal(first.ticker, 'BMRI')
  assert.equal(first.open, 4200)
  assert.equal(first.close, 4210)
  assert.equal(first.volume, 100000)
})

test('parseYahooChartResponse filters out bars outside continuous trading hours', () => {
  // Monday 2026-09-21
  // 12:15 WIB (Lunch break, non-continuous) = 05:15 UTC
  const lunchTs = Math.floor(new Date('2026-09-21T05:15:00Z').getTime() / 1000)
  // 16:00 WIB (Pre-closing, non-continuous) = 09:00 UTC
  const postTs = Math.floor(new Date('2026-09-21T09:00:00Z').getTime() / 1000)
  // 14:00 WIB (S2 valid) = 07:00 UTC
  const s2Ts = Math.floor(new Date('2026-09-21T07:00:00Z').getTime() / 1000)

  const mockResponse = {
    chart: {
      result: [
        {
          timestamp: [lunchTs, s2Ts, postTs],
          indicators: {
            quote: [
              {
                open: [4200, 4210, 4200],
                high: [4220, 4220, 4210],
                low: [4190, 4200, 4190],
                close: [4210, 4210, 4200],
                volume: [50000, 80000, 90000],
              },
            ],
          },
        },
      ],
    },
  }

  const parsed = parseYahooChartResponse(mockResponse, 'BMRI')
  assert.equal(parsed.success, true)
  assert.ok(parsed.data)
  // Only the S2 bar should remain
  assert.equal(parsed.data.bars.length, 1)
  assert.equal(parsed.data.bars[0].open, 4210)
})

test('parseYahooChartResponse captures error when Yahoo API returns error payload', () => {
  const mockError = {
    chart: {
      error: {
        code: 'Not Found',
        description: 'No data found for symbol XYZ.JK',
      },
    },
  }

  const parsed = parseYahooChartResponse(mockError, 'XYZ')
  assert.equal(parsed.success, false)
  assert.match(parsed.error || '', /No data found for symbol XYZ\.JK/)
})

test('parseYahooChartResponse detects invalid bar relationships', () => {
  const baseTs = Math.floor(new Date('2026-09-21T02:00:00Z').getTime() / 1000)

  const mockBad = {
    chart: {
      result: [
        {
          timestamp: [baseTs],
          indicators: {
            quote: [
              {
                open: [4200],
                high: [4100], // High < Low and High < Open (Invalid!)
                low: [4300],
                close: [4200],
                volume: [1000],
              },
            ],
          },
        },
      ],
    },
  }

  const parsed = parseYahooChartResponse(mockBad, 'BMRI')
  assert.equal(parsed.success, true)
  assert.ok(parsed.data)
  assert.equal(parsed.data.bars.length, 0)
  assert.equal(parsed.data.issues.length, 1)
  assert.equal(parsed.data.issues[0].code, 'INVALID_BAR_RELATION')
})
