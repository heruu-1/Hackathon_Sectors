import assert from 'node:assert/strict'
import test from 'node:test'

import { evaluateSignalOutcomes } from '../domain/signal-outcomes.ts'

test('evaluateSignalOutcomes calculates forward returns accurately when data is present', () => {
  const dailyPrices = [
    { date: '2024-08-01', close: 1000 },
    { date: '2024-08-02', close: 1020 }, // 1-session forward (+2%)
    { date: '2024-08-05', close: 1010 },
    { date: '2024-08-06', close: 1050 }, // 3-session forward (+5%)
    { date: '2024-08-07', close: 1040 },
    { date: '2024-08-08', close: 1100 }, // 5-session forward (+10%)
  ]

  const outcomes = evaluateSignalOutcomes(
    'snap-test-1',
    'BBCA',
    'R01',
    'rasi-mi-v2',
    '2024-08-01',
    1000,
    dailyPrices,
  )

  assert.equal(outcomes.length, 3)

  // 1 session
  assert.equal(outcomes[0].horizon, 1)
  assert.equal(outcomes[0].status, 'MATURED')
  assert.equal(outcomes[0].targetDate, '2024-08-02')
  assert.equal(outcomes[0].targetPrice, 1020)
  assert.equal(outcomes[0].returnFraction, 0.02)

  // 3 session
  assert.equal(outcomes[1].horizon, 3)
  assert.equal(outcomes[1].status, 'MATURED')
  assert.equal(outcomes[1].targetDate, '2024-08-06')
  assert.equal(outcomes[1].targetPrice, 1050)
  assert.equal(outcomes[1].returnFraction, 0.05)

  // 5 session
  assert.equal(outcomes[2].horizon, 5)
  assert.equal(outcomes[2].status, 'MATURED')
  assert.equal(outcomes[2].targetDate, '2024-08-08')
  assert.equal(outcomes[2].targetPrice, 1100)
  assert.equal(outcomes[2].returnFraction, 0.1)
})

test('evaluateSignalOutcomes marks status PENDING when future sessions have not occurred yet', () => {
  const dailyPrices = [
    { date: '2024-08-01', close: 1000 },
    { date: '2024-08-02', close: 1030 },
  ]

  const outcomes = evaluateSignalOutcomes(
    'snap-test-2',
    'BBCA',
    'R04',
    'rasi-mi-v2',
    '2024-08-01',
    1000,
    dailyPrices,
  )

  assert.equal(outcomes[0].horizon, 1)
  assert.equal(outcomes[0].status, 'MATURED')
  assert.equal(outcomes[0].returnFraction, 0.03)

  assert.equal(outcomes[1].horizon, 3)
  assert.equal(outcomes[1].status, 'PENDING')
  assert.equal(outcomes[1].targetPrice, null)

  assert.equal(outcomes[2].horizon, 5)
  assert.equal(outcomes[2].status, 'PENDING')
  assert.equal(outcomes[2].targetPrice, null)
})

test('evaluateSignalOutcomes handles missing signal date gracefully', () => {
  const dailyPrices = [{ date: '2024-08-02', close: 1030 }]

  const outcomes = evaluateSignalOutcomes(
    'snap-test-3',
    'BBCA',
    'R04',
    'rasi-mi-v2',
    '2024-08-01',
    1000,
    dailyPrices,
  )

  assert.equal(outcomes[0].status, 'MISSING_PRICE')
  assert.equal(outcomes[1].status, 'MISSING_PRICE')
  assert.equal(outcomes[2].status, 'MISSING_PRICE')
})
