import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// Run the actual cache implementation with only its database boundary replaced.
function loadCache() {
  let now = Date.parse('2026-09-21T00:00:00Z')
  class Clock extends Date {
    constructor(value = now) {
      super(value)
    }
    static now() {
      return now
    }
  }
  const output = ts.transpileModule(
    readFileSync(new URL('../lib/server/cache.ts', import.meta.url), 'utf8'),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    },
  ).outputText
  const exports = {}
  vm.runInNewContext(output, {
    exports,
    Date: Clock,
    crypto,
    process: { env: {} },
    require: (name) => {
      if (name === '@/db' || name === '../../db/index.ts') return { db: {} }
      if (name === '@/db/schema' || name === '../../db/schema.ts')
        return { apiCache: {}, cacheLeases: {} }
      if (name === 'drizzle-orm') return { and() {}, eq() {}, gt() {}, lt() {} }
      throw new Error(`Unexpected dependency: ${name}`)
    },
  })
  return {
    cache: exports.getOrSetCache,
    advance: (ms) => {
      now += ms
    },
  }
}

test('cache shares concurrent reads and retains short trading histories', async () => {
  const { cache } = loadCache()
  let calls = 0
  const fetcher = async () => {
    calls++
    return [1, 2]
  }
  const results = await Promise.all([
    cache('prices', 900000, fetcher),
    cache('prices', 900000, fetcher),
  ])
  assert.deepEqual(results, [
    [1, 2],
    [1, 2],
  ])
  await cache('prices', 900000, fetcher)
  assert.equal(calls, 1)
})

test('manual refresh updates subsequent reads and observes its cooldown', async () => {
  const { cache, advance } = loadCache()
  let calls = 0
  const fetcher = async () => ++calls
  assert.equal(await cache('quote', 900000, fetcher), 1)
  assert.equal(await cache('quote', 900000, fetcher, { forceRefresh: true }), 1)
  advance(61000)
  assert.equal(await cache('quote', 900000, fetcher, { forceRefresh: true }), 2)
  assert.equal(await cache('quote', 900000, fetcher), 2)
  assert.equal(calls, 2)
})

test('failed refresh releases in-flight request and preserves the previous cache', async () => {
  const { cache, advance } = loadCache()
  await cache('quote', 900000, async () => 42)
  advance(61000)
  await assert.rejects(
    cache(
      'quote',
      900000,
      async () => {
        throw new Error('offline')
      },
      { forceRefresh: true },
    ),
    /offline/,
  )
  assert.equal(await cache('quote', 900000, async () => 100), 42)
})
