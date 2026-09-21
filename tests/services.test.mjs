import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { AssistantRequestSchema, ProposedActionSchema } from '../lib/contracts/assistant.ts'
import {
  AddWatchlistSchema,
  TickerSchema,
  UpdateWatchlistSchema,
} from '../lib/contracts/watchlist.ts'

describe('Watchlist Service & Contract Validation', () => {
  test('validates 4-letter IDX ticker correctly', () => {
    assert.equal(TickerSchema.parse('bbca'), 'BBCA')
    assert.equal(TickerSchema.parse('BBRI.JK'), 'BBRI')
    assert.equal(TickerSchema.parse(' tlkm '), 'TLKM')

    assert.throws(() => TickerSchema.parse('INVALID123'), /Kode saham/)
    assert.throws(() => TickerSchema.parse('B'), /Kode saham/)
    assert.throws(() => TickerSchema.parse(''), /Kode saham/)
  })

  test('validates AddWatchlistSchema with valid input', () => {
    const input = {
      ticker: 'BBCA',
      name: 'Bank Central Asia',
      targetPrice: 10500,
      notes: 'Pantau akumulasi asing di area support.',
      priority: 'HIGH',
      status: 'WATCHING',
    }
    const parsed = AddWatchlistSchema.parse(input)
    assert.equal(parsed.ticker, 'BBCA')
    assert.equal(parsed.targetPrice, 10500)
    assert.equal(parsed.priority, 'HIGH')
  })

  test('enforces max 2,000 characters for notes in AddWatchlistSchema', () => {
    const validNotes = 'a'.repeat(2000)
    const parsed = AddWatchlistSchema.parse({
      ticker: 'BBCA',
      notes: validNotes,
    })
    assert.equal(parsed.notes?.length, 2000)

    const invalidNotes = 'a'.repeat(2001)
    const result = AddWatchlistSchema.safeParse({
      ticker: 'BBCA',
      notes: invalidNotes,
    })
    assert.equal(result.success, false)
    if (!result.success) {
      assert.match(result.error.issues[0].message, /Catatan maksimal 2\.000/)
    }
  })

  test('enforces max 2,000 characters for notes in UpdateWatchlistSchema', () => {
    const invalidNotes = 'b'.repeat(2001)
    const result = UpdateWatchlistSchema.safeParse({ notes: invalidNotes })
    assert.equal(result.success, false)
    if (!result.success) {
      assert.match(result.error.issues[0].message, /Catatan maksimal 2\.000/)
    }

    const validResult = UpdateWatchlistSchema.safeParse({ notes: 'Catatan baru' })
    assert.equal(validResult.success, true)
  })

  test('rejects negative or zero target prices', () => {
    assert.equal(AddWatchlistSchema.safeParse({ ticker: 'BBCA', targetPrice: -100 }).success, false)
    assert.equal(AddWatchlistSchema.safeParse({ ticker: 'BBCA', targetPrice: 0 }).success, false)
    assert.equal(AddWatchlistSchema.safeParse({ ticker: 'BBCA', targetPrice: 1000 }).success, true)
  })
})

describe('Assistant Contract & Action Validation', () => {
  test('validates valid AssistantRequestSchema', () => {
    const req = {
      message: 'Bagaimana tren akumulasi broker BBCA seminggu terakhir?',
      ticker: 'BBCA',
      requestKey: '123e4567-e89b-12d3-a456-426614174000',
    }
    const parsed = AssistantRequestSchema.parse(req)
    assert.equal(parsed.ticker, 'BBCA')
    assert.equal(parsed.message, req.message)
  })

  test('rejects empty message or message exceeding 2000 chars', () => {
    assert.equal(
      AssistantRequestSchema.safeParse({
        message: '   ',
        requestKey: '123e4567-e89b-12d3-a456-426614174000',
      }).success,
      false,
    )

    assert.equal(
      AssistantRequestSchema.safeParse({
        message: 'x'.repeat(2001),
        requestKey: '123e4567-e89b-12d3-a456-426614174000',
      }).success,
      false,
    )
  })

  test('restricts ProposedAction to ADD_WATCHLIST only', () => {
    const validAction = {
      type: 'ADD_WATCHLIST',
      ticker: 'BBCA',
      label: 'Pantau BBCA di Watchlist',
    }
    const parsed = ProposedActionSchema.parse(validAction)
    assert.equal(parsed.type, 'ADD_WATCHLIST')
    assert.equal(parsed.ticker, 'BBCA')

    const invalidAction = {
      type: 'BUY_ORDER',
      ticker: 'BBCA',
      label: 'Beli Saham',
    }
    assert.equal(ProposedActionSchema.safeParse(invalidAction).success, false)
  })
})

describe('History Pagination & Bounds Logic', () => {
  test('clamps pagination limit between 1 and 50', () => {
    function clampPagination(options) {
      const limit = Math.min(Math.max(options?.limit ?? 20, 1), 50)
      const offset = Math.max(options?.offset ?? 0, 0)
      return { limit, offset }
    }

    assert.deepEqual(clampPagination({ limit: 0, offset: -5 }), { limit: 1, offset: 0 })
    assert.deepEqual(clampPagination({ limit: 100, offset: 10 }), { limit: 50, offset: 10 })
    assert.deepEqual(clampPagination({ limit: 25, offset: 50 }), { limit: 25, offset: 50 })
    assert.deepEqual(clampPagination({}), { limit: 20, offset: 0 })
  })
})

describe('Idempotency Deduplication Logic', () => {
  test('returns cached result on repeated calls with identical request key', async () => {
    const memoryStore = new Map()

    async function withMemoryIdempotency(userId, op, key, execute) {
      const compositeKey = `${userId}:${op}:${key}`
      if (memoryStore.has(compositeKey)) {
        return memoryStore.get(compositeKey)
      }
      const result = await execute()
      memoryStore.set(compositeKey, result)
      return result
    }

    let executionCount = 0
    const operation = async () => {
      executionCount++
      return { id: 'snapshot-123', ticker: 'BBCA' }
    }

    const res1 = await withMemoryIdempotency('user-1', 'analysis', 'key-abc', operation)
    const res2 = await withMemoryIdempotency('user-1', 'analysis', 'key-abc', operation)
    const res3 = await withMemoryIdempotency('user-1', 'analysis', 'key-different', operation)

    assert.equal(executionCount, 2)
    assert.deepEqual(res1, res2)
    assert.equal(res1.ticker, 'BBCA')
    assert.equal(res3.ticker, 'BBCA')
  })
})
