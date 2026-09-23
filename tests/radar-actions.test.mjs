import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

import { detectCatalystDivergence } from '../domain/divergence.ts'
import * as radar from '../domain/radar.ts'
import { isValidTicker } from '../domain/ticker.ts'
import { fallbackAnalyzeNews } from '../lib/server/providers/gemini.ts'

function loadRadar() {
  let now = Date.parse('2026-09-21T00:00:00Z')
  let failed = false
  let newsCalls = 0
  class Clock extends Date {
    constructor(value = now) {
      super(value)
    }
    static now() {
      return now
    }
  }
  const exports = {}
  const output = ts.transpileModule(
    readFileSync(new URL('../app/actions.ts', import.meta.url), 'utf8'),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    },
  ).outputText
  const modules = {
    '@/domain/divergence': { detectCatalystDivergence },
    '@/domain/radar': { ...radar, isRadarFresh: (date) => radar.isRadarFresh(date, now) },
    '@/domain/ticker': { isValidTicker },
    '@/lib/server/cache': { getOrSetCache: (_key, _ttl, fetcher) => fetcher() },
    '@/lib/server/providers/gemini': {
      fallbackAnalyzeNews,
      analyzeNewsImpact: () => {
        throw new Error('Public radar must not consume Gemini quota')
      },
    },
    '@/lib/sectors': {
      fetchMarketNews: async () => {
        newsCalls++
        if (failed) throw new Error('Provider unavailable')
        return [
          {
            title: 'BBCA acquisition partnership',
            body: '',
            symbols: ['BBCA.JK'],
            timestamp: '2026-09-16T10:00:00+07:00',
          },
          {
            title: 'BBRI acquisition partnership',
            body: '',
            symbols: ['BBRI.JK'],
            timestamp: '2026-09-16T10:00:00+07:00',
          },
        ]
      },
      fetchInsiderFilings: async () => [],
      fetchDailyTransactions: async (ticker) =>
        ticker === 'BBCA'
          ? [
              { date: '2026-09-15', close: 100 },
              { date: '2026-09-18', close: 101 },
            ]
          : [],
    },
  }
  const radarOutput = ts.transpileModule(
    readFileSync(new URL('../app/actions/radar.ts', import.meta.url), 'utf8'),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    },
  ).outputText
  const radarExports = {}
  vm.runInNewContext(radarOutput, {
    exports: radarExports,
    Date: Clock,
    process: { env: {} },
    require: (name) => modules[name] ?? {},
  })
  modules['./actions/radar'] = radarExports

  vm.runInNewContext(output, {
    exports,
    Date: Clock,
    process: { env: {} },
    require: (name) => modules[name] ?? {},
  })
  return {
    actions: exports,
    calls: () => newsCalls,
    fail: () => {
      failed = true
      now += 61_000
    },
  }
}

test('public radar deduplicates scans, excludes missing prices, and cannot erase shared history', async () => {
  const { actions, calls } = loadRadar()
  const [first, second] = await Promise.all([
    actions.getMarketRadarFeed(),
    actions.getMarketRadarFeed(),
  ])
  assert.equal(first.success, true)
  assert.equal(second.data.sleepingGiants.length, 1)
  assert.equal(first.data.sleepingGiants[0].ticker, 'BBCA')
  assert.equal(first.data.pendingCatalysts.length, 1)
  assert.equal(first.data.pendingCatalysts[0].ticker, 'BBRI')
  assert.equal(first.data.pendingCatalysts[0].priceChangePct, null)
  assert.equal(calls(), 1)
  assert.equal((await actions.clearRadarHistory()).success, false)
  assert.equal((await actions.getRadarHistory()).data.length, 1)
  assert.equal((await actions.getRadarHistory()).data[0].pendingCatalysts[0].ticker, 'BBRI')
})

test('radar reports a failed refresh while preserving the last successful scan', async () => {
  const { actions, fail } = loadRadar()
  const first = await actions.getMarketRadarFeed()
  fail()
  const retry = await actions.getMarketRadarFeed({ forceRefresh: true })
  assert.equal(retry.data.scannedAt, first.data.scannedAt)
  assert.match(retry.data.warning, /gagal/)
  assert.equal((await actions.getRadarHistory()).data.length, 1)
})
