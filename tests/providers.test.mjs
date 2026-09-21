import assert from 'node:assert/strict'
import { test } from 'node:test'

import { analyzeNewsImpact, fallbackAnalyzeNews } from '../lib/server/providers/gemini.ts'
import {
  fetchCompanyValuation,
  fetchDailyPrices,
  fetchMarketNews,
} from '../lib/server/providers/sectors.ts'

test('news fallback does not treat refinery as a fine or count dividend twice', () => {
  assert.equal(fallbackAnalyzeNews('Refinery operations update', '').impactScore, 0)
  assert.equal(fallbackAnalyzeNews('Company announces dividend', '').impactScore, 25)
})

test('daily prices preserve missing OHLC values instead of inventing zero prices', async () => {
  const result = await fetchDailyPrices('BBCA', 'test-key', 90, async () =>
    Response.json([{ date: '2026-09-18', close: 9000, open: null, high: null, low: null }]),
  )
  assert.equal(result.data[0].open, null)
  assert.equal(result.data[0].high, null)
  assert.equal(result.data[0].low, null)
})

test('Sectors provider: returns error DataEnvelope for missing or placeholder API key', async () => {
  const env1 = await fetchCompanyValuation('BBCA', '')
  assert.equal(env1.state, 'error')
  assert.match(env1.issues[0].message, /SECTORS_API_KEY/)

  const env2 = await fetchCompanyValuation('BBCA', 'your_sectors_api_key_here')
  assert.equal(env2.state, 'error')
  assert.match(env2.issues[0].message, /SECTORS_API_KEY/)
})

test('Sectors provider: produces ready DataEnvelope for valid response', async () => {
  const mockFetch = async () =>
    new Response(
      JSON.stringify({
        symbol: 'BBCA.JK',
        company_name: 'PT Bank Central Asia Tbk.',
        valuation: {
          last_close_price: 6325,
          latest_close_date: '2026-09-18',
          daily_close_change: 0.015,
          historical_valuation: [{ year: 2026, pe: 13.5, pb: 2.8 }],
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )

  const env = await fetchCompanyValuation('BBCA', 'valid-key', mockFetch)
  assert.equal(env.state, 'ready')
  assert.equal(env.source, 'SECTORS')
  assert.equal(env.data?.symbol, 'BBCA')
  assert.equal(env.data?.lastClosePrice, 6325)
})

test('Sectors provider: produces empty DataEnvelope for empty results', async () => {
  const mockFetch = async () =>
    new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  const env = await fetchMarketNews('BBCA', 'valid-key', 5, mockFetch)
  assert.equal(env.state, 'empty')
  assert.equal(env.data, null)
  assert.ok(env.issues.some((i) => i.code === 'NO_RECORDS'))
})

test('Sectors provider: produces error DataEnvelope on HTTP error without leaking secrets', async () => {
  const mockFetch = async () =>
    new Response(JSON.stringify({ detail: 'Unauthorized' }), { status: 401 })

  const env = await fetchDailyPrices('BBCA', 'secret-key-12345', 30, mockFetch)
  assert.equal(env.state, 'error')
  assert.equal(env.data, null)
  assert.match(env.issues[0].message, /API key/)
  assert.doesNotMatch(env.issues[0].message, /secret-key-12345/)
})

test('Gemini provider: parses valid JSON response correctly', async () => {
  const mockFetch = async () =>
    new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    sentiment: 'BULLISH',
                    impactScore: 85,
                    catalystType: 'ACQUISITION',
                    headlineId: 'Akuisisi Bernilai Strategis',
                    summaryId: 'Perseroan menuntaskan akuisisi bernilai positif.',
                  }),
                },
              ],
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )

  const result = await analyzeNewsImpact(
    'Akuisisi Sukses',
    'Badan usaha baru bergabung.',
    'BBCA',
    'valid-gemini-key',
    'gemini-2.5-flash',
    mockFetch,
  )

  assert.equal(result.sentiment, 'BULLISH')
  assert.equal(result.impactScore, 85)
  assert.equal(result.analysisSource, 'GEMINI')
  assert.equal(result.isAiGenerated, true)
})

test('Gemini provider: falls back to rule-based on malformed JSON or error', async () => {
  const mockFetchError = async () => new Response('Internal Server Error', { status: 500 })

  const result = await analyzeNewsImpact(
    'Laba Melonjak Drastis',
    'Perseroan mencatat laba naik pesat tahun ini.',
    'BBCA',
    'valid-gemini-key',
    'gemini-2.5-flash',
    mockFetchError,
  )

  assert.equal(result.analysisSource, 'RULE_BASED')
  assert.equal(result.isAiGenerated, false)
  assert.equal(result.sentiment, 'BULLISH')
  assert.ok(result.impactScore > 0)
})

test('Gemini fallback: detects bearish keywords accurately', () => {
  const result = fallbackAnalyzeNews(
    'Rugi Bersih Membengkak dan Denda OJK',
    'Emiten menerima sanksi suspensi perdagangan akibat default utang.',
  )
  assert.equal(result.analysisSource, 'RULE_BASED')
  assert.equal(result.sentiment, 'BEARISH')
  assert.ok(result.impactScore < -40)
})
