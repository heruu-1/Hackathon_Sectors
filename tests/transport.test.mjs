import assert from 'node:assert/strict'
import test from 'node:test'

import { _resetInMemoryBudget } from '../lib/server/budget.ts'
import { SectorsProviderError, requestSectorsShared } from '../lib/server/providers/transport.ts'

test('requestSectorsShared executes successfully with valid mock fetch and commits credits', async () => {
  _resetInMemoryBudget(10)

  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => [{ symbol: 'BBCA', close: 10500 }],
  })

  const result = await requestSectorsShared('https://api.sectors.app/v2/daily/BBCA/', {
    capabilityId: 'daily_price',
    apiKey: 'test-api-key',
    fetchFn: mockFetch,
  })

  assert.deepEqual(result, [{ symbol: 'BBCA', close: 10500 }])
})

test('requestSectorsShared throws BUDGET_EXHAUSTED when credits are insufficient', async () => {
  _resetInMemoryBudget(0) // 0 credits available

  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({}),
  })

  await assert.rejects(
    async () => {
      await requestSectorsShared('https://api.sectors.app/v2/daily/BBCA/', {
        capabilityId: 'daily_price',
        apiKey: 'test-api-key',
        fetchFn: mockFetch,
      })
    },
    (err) => {
      assert.ok(err instanceof SectorsProviderError)
      assert.equal(err.code, 'BUDGET_EXHAUSTED')
      assert.equal(err.statusCode, 429)
      return true
    },
  )
})

test('requestSectorsShared handles 404 cleanly without leaking credentials', async () => {
  _resetInMemoryBudget(10)

  const mockFetch = async () => ({
    ok: false,
    status: 404,
  })

  await assert.rejects(
    async () => {
      await requestSectorsShared('https://api.sectors.app/v2/daily/INVALID/', {
        capabilityId: 'daily_price',
        apiKey: 'super-secret-key',
        fetchFn: mockFetch,
      })
    },
    (err) => {
      assert.ok(err instanceof SectorsProviderError)
      assert.equal(err.statusCode, 404)
      assert.ok(!err.message.includes('super-secret-key'))
      return true
    },
  )
})
