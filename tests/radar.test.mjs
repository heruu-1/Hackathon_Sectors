import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getNewsPriceResponse, isRadarFresh, visibleRadarHistory } from '../domain/radar.ts'

test('radar requires a price comparison spanning the news event', () => {
  const rows = [
    { date: '2026-09-18', close: 120 },
    { date: '2026-09-15', close: 100 },
    { date: '2026-09-17', close: 110 },
  ]
  assert.equal(getNewsPriceResponse(rows, '2026-09-16T10:00:00+07:00'), 0.2)
  assert.equal(getNewsPriceResponse(rows, '2026-09-18T17:00:00+07:00'), null)
  assert.equal(getNewsPriceResponse(rows, 'invalid'), null)
  assert.equal(getNewsPriceResponse(rows, '2026-09-01'), null)
})

test('radar cache expires and rejects future or invalid scan dates', () => {
  const now = Date.parse('2026-09-21T10:00:00Z')
  assert.equal(isRadarFresh('2026-09-21T09:55:00Z', now), true)
  assert.equal(isRadarFresh('2026-09-21T09:00:00Z', now), false)
  assert.equal(isRadarFresh('2026-09-22T09:55:00Z', now), false)
  assert.equal(isRadarFresh(undefined, now), false)
})

test('hiding local radar history preserves shared snapshots and later scans', () => {
  const history = [{ scannedAt: '2026-09-21T10:00:00Z' }, { scannedAt: '2026-09-20T10:00:00Z' }]
  assert.deepEqual(visibleRadarHistory(history, '2026-09-20T10:00:00Z'), [history[0]])
  assert.equal(history.length, 2)
  assert.deepEqual(visibleRadarHistory(history, 'broken'), history)
})
