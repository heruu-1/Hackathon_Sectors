import assert from 'node:assert/strict'
import test from 'node:test'

import { withIdempotency } from '../lib/server/idempotency.ts'

test('withIdempotency deduplicates concurrent in-flight requests', async () => {
  let executeCount = 0
  const executeFn = async () => {
    executeCount++
    await new Promise((resolve) => setTimeout(resolve, 50))
    return { data: 'test-success' }
  }

  // Launch two concurrent executions with same userId, op, requestKey
  const [res1, res2] = await Promise.all([
    withIdempotency('user_123', 'test_op', 'req_key_abc', executeFn),
    withIdempotency('user_123', 'test_op', 'req_key_abc', executeFn),
  ])

  assert.equal(executeCount, 1)
  assert.deepEqual(res1, { data: 'test-success' })
  assert.deepEqual(res2, { data: 'test-success' })
})
