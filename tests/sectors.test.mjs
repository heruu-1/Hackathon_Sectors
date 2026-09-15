import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SectorsError, buildAnalysis, fetchCompanyReport, normalizeTicker } from '../lib/sectors.ts'

function report(valuation = {}) {
  return {
    symbol: 'BBCA.JK',
    company_name: 'PT Bank Central Asia Tbk.',
    valuation: {
      last_close_price: 6325,
      latest_close_date: '2026-09-11',
      daily_close_change: -0.0155642,
      historical_valuation: [{ year: 2026, pe: 13.28, pb: 2.85 }],
      ...valuation,
    },
  }
}

test('uses the latest year, regardless of history order, for P/E and P/B scoring', () => {
  const result = buildAnalysis(
    report({
      historical_valuation: [
        { year: 2026, pe: 50, pb: 12 },
        { year: 2024, pe: 10, pb: 1 },
      ],
    }),
    'BBCA',
  )
  assert.equal(result.risk, 85)
  assert.equal(result.status, 'CRITICAL')
  assert.match(result.reason, /2026/)
  assert.match(result.reason, /50\.00/)
})

test('shows the real closing price, signed daily change and source date', () => {
  const result = buildAnalysis(report(), 'BBCA')
  assert.equal(result.price, 'Rp 6.325')
  assert.equal(result.change, '-1.56%')
  assert.equal(result.volumeSpike, 'N/A')
  assert.match(result.reason, /2026-09-11/)
})

test('does not classify missing ratios as NORMAL or silently use an older year', () => {
  for (const historical_valuation of [
    [],
    [
      { year: 2025, pe: 10, pb: 1 },
      { year: 2026, pe: null, pb: 2 },
    ],
    [{ year: 2026, pe: 'invalid', pb: 2 }],
  ]) {
    assert.throws(() => buildAnalysis(report({ historical_valuation }), 'BBCA'), /P\/E.*P\/B/)
  }
})

test('handles zero and negative ratios without treating zero as missing', () => {
  assert.equal(
    buildAnalysis(
      report({ historical_valuation: [{ year: 2026, pe: 0, pb: 0 }], daily_close_change: 0 }),
      'BBCA',
    ).change,
    '0.00%',
  )
  const negative = buildAnalysis(
    report({ historical_valuation: [{ year: 2026, pe: -3, pb: 2 }] }),
    'BBCA',
  )
  assert.equal(negative.risk, 55)
  assert.equal(negative.status, 'WARNING')
})

test('accepts numeric ratio strings but rejects invalid or mismatched reports', () => {
  assert.equal(
    buildAnalysis(report({ historical_valuation: [{ year: '2026', pe: '50', pb: '12' }] }), 'BBCA')
      .risk,
    85,
  )
  assert.throws(() => buildAnalysis(null, 'BBCA'))
  assert.throws(() => buildAnalysis({ ...report(), symbol: 'TLKM.JK' }, 'BBCA'))
})

test('normalizes IDX input and rejects invalid tickers before fetching', () => {
  assert.equal(normalizeTicker(' bbca.jk '), 'BBCA')
  for (const value of ['', null, '../BBCA', 'AAPL.US', 'BBCA?x=1']) {
    assert.throws(() => normalizeTicker(value), SectorsError)
  }
})

test('fetches only valuation with a timeout, without retaining cached credentials', async () => {
  let captured
  const result = await fetchCompanyReport('BBCA', 'test-key', async (url, options) => {
    captured = { url: new URL(url), options }
    return Response.json(report())
  })
  assert.equal(result.symbol, 'BBCA.JK')
  assert.equal(captured.url.searchParams.get('sections'), 'valuation')
  assert.ok(captured.options.signal instanceof AbortSignal)
  assert.equal(captured.options.cache, 'no-store')
})

test('rejects missing or placeholder API keys without a network request', async () => {
  for (const key of [undefined, '', '  ', 'your_sectors_api_key_here']) {
    await assert.rejects(
      fetchCompanyReport('BBCA', key, async () => {
        assert.fail('Should not fetch without a key')
      }),
      /SECTORS_API_KEY/,
    )
  }
})

test('explains authentication, missing ticker and rate-limit errors', async () => {
  for (const [status, message] of [
    [401, /API key/],
    [403, /akses/],
    [404, /tidak ditemukan/],
    [429, /Batas permintaan/],
  ]) {
    await assert.rejects(
      fetchCompanyReport('BBCA', 'test-key', async () => new Response('', { status })),
      message,
    )
  }
})

test('explains timeout and connection failures without leaking upstream details', async () => {
  await assert.rejects(
    fetchCompanyReport('BBCA', 'test-key', async () => {
      throw new DOMException('timeout', 'TimeoutError')
    }),
    /10 detik/,
  )
  await assert.rejects(
    fetchCompanyReport('BBCA', 'test-key', async () => {
      throw new Error('Private upstream detail')
    }),
    /Tidak dapat menghubungi Sectors/,
  )
})

test('aborts a stalled response body instead of leaving analysis pending', async (t) => {
  const originalTimeout = AbortSignal.timeout
  t.mock.method(AbortSignal, 'timeout', (ms) => {
    assert.equal(ms, 10_000)
    return originalTimeout(10)
  })
  const keepAlive = setTimeout(() => {}, 1000)
  try {
    await assert.rejects(
      fetchCompanyReport('BBCA', 'test-key', async (_url, { signal }) => ({
        ok: true,
        json: () =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason), { once: true })
          }),
      })),
      /10 detik/,
    )
  } finally {
    clearTimeout(keepAlive)
  }
})

test('keeps missing price and change distinct from a measured zero', () => {
  const result = buildAnalysis(report({ last_close_price: null, daily_close_change: null }), 'BBCA')
  assert.equal(result.price, 'N/A')
  assert.equal(result.change, 'N/A')
})
