import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  COMPOSITE_WEIGHTS,
  RASI_RULE_VERSION,
  SNAPSHOT_SCHEMA_VERSION,
} from '../lib/contracts/analysis.ts'
import { AssistantRequestSchema } from '../lib/contracts/assistant.ts'
import {
  createEmptyEnvelope,
  createEnvelope,
  createErrorEnvelope,
} from '../lib/contracts/market.ts'
import { HTTP_STATUS_MAP, errorResult, successResult } from '../lib/contracts/result.ts'
import { AddWatchlistSchema, TickerSchema } from '../lib/contracts/watchlist.ts'

test('Result contracts: returns properly structured success and error results', () => {
  const success = successResult({ count: 42 }, 'req-123')
  assert.equal(success.ok, true)
  assert.equal(success.data.count, 42)
  assert.equal(success.requestId, 'req-123')

  const error = errorResult('AUTH_REQUIRED', 'Harap login terlebih dahulu.', {
    requestId: 'req-456',
  })
  assert.equal(error.ok, false)
  assert.equal(error.error.code, 'AUTH_REQUIRED')
  assert.equal(error.error.message, 'Harap login terlebih dahulu.')
  assert.equal(error.requestId, 'req-456')
  assert.equal(HTTP_STATUS_MAP[error.error.code], 401)
})

test('DataEnvelope: distinguishes empty from error, and preserves null distinctly from 0', () => {
  const emptyEnv = createEmptyEnvelope('SECTORS', '2026-09-18')
  assert.equal(emptyEnv.state, 'empty')
  assert.equal(emptyEnv.data, null)
  assert.equal(emptyEnv.source, 'SECTORS')
  assert.equal(emptyEnv.issues[0].code, 'NO_RECORDS')

  const errorEnv = createErrorEnvelope('SECTORS', 'Sectors timeout 10s', 'TIMEOUT')
  assert.equal(errorEnv.state, 'error')
  assert.equal(errorEnv.data, null)
  assert.equal(errorEnv.issues[0].code, 'TIMEOUT')

  const zeroDataEnv = createEnvelope({
    state: 'ready',
    data: { value: 0 },
    source: 'SECTORS',
  })
  assert.equal(zeroDataEnv.state, 'ready')
  assert.equal(zeroDataEnv.data.value, 0)
  assert.notEqual(zeroDataEnv.data.value, null)

  const nullDataEnv = createEnvelope({
    state: 'partial',
    data: { value: null },
    source: 'SECTORS',
  })
  assert.equal(nullDataEnv.state, 'partial')
  assert.equal(nullDataEnv.data.value, null)
})

test('TickerSchema: normalizes lowercase, .JK suffix, whitespace, and rejects invalid tickers', () => {
  assert.equal(TickerSchema.parse('bbca'), 'BBCA')
  assert.equal(TickerSchema.parse(' bbca.jk '), 'BBCA')
  assert.equal(TickerSchema.parse('TLKM.JK'), 'TLKM')

  assert.throws(() => TickerSchema.parse('ABC'), /Kode saham/)
  assert.throws(() => TickerSchema.parse('BBCA1'), /Kode saham/)
  assert.throws(() => TickerSchema.parse('AAPL.US'), /Kode saham/)
})

test('Watchlist validation: rejects unknown fields and validates bounds', () => {
  const valid = AddWatchlistSchema.parse({
    ticker: 'bbca.jk',
    name: 'PT Bank Central Asia Tbk',
    priority: 'HIGH',
    status: 'ACCUMULATING',
    targetPrice: 7500,
    notes: 'Catatan analisis',
  })
  assert.equal(valid.ticker, 'BBCA')
  assert.equal(valid.targetPrice, 7500)

  // Rejects unknown fields (.strict())
  assert.throws(
    () =>
      AddWatchlistSchema.parse({
        ticker: 'BBCA',
        hackedField: 'injection',
      }),
    /unrecognized_keys/,
  )

  // Rejects notes exceeding 2000 characters
  assert.throws(
    () =>
      AddWatchlistSchema.parse({
        ticker: 'BBCA',
        notes: 'a'.repeat(2001),
      }),
    /2\.000/,
  )
})

test('Assistant validation: requires valid UUID requestKey and bounds message length', () => {
  const valid = AssistantRequestSchema.parse({
    message: 'Apa kondisi BBCA saat ini?',
    ticker: 'bbca',
    requestKey: '123e4567-e89b-12d3-a456-426614174000',
  })
  assert.equal(valid.ticker, 'BBCA')
  assert.equal(valid.message, 'Apa kondisi BBCA saat ini?')

  // Rejects non-UUID requestKey
  assert.throws(
    () =>
      AssistantRequestSchema.parse({
        message: 'Halo',
        requestKey: 'not-a-uuid',
      }),
    /UUID/,
  )

  // Rejects empty message
  assert.throws(
    () =>
      AssistantRequestSchema.parse({
        message: '   ',
        requestKey: '123e4567-e89b-12d3-a456-426614174000',
      }),
    /tidak boleh kosong/,
  )
})

test('Analysis contracts: verifies composite weights and versions', () => {
  assert.equal(COMPOSITE_WEIGHTS.fundamental, 0.25)
  assert.equal(COMPOSITE_WEIGHTS.broker, 0.35)
  assert.equal(COMPOSITE_WEIGHTS.divergence, 0.25)
  assert.equal(COMPOSITE_WEIGHTS.insider, 0.15)
  const total =
    COMPOSITE_WEIGHTS.fundamental +
    COMPOSITE_WEIGHTS.broker +
    COMPOSITE_WEIGHTS.divergence +
    COMPOSITE_WEIGHTS.insider
  assert.equal(total, 1.0)
  assert.equal(SNAPSHOT_SCHEMA_VERSION, '1.0.0')
  assert.equal(RASI_RULE_VERSION, '1.0.0')
})
