import assert from 'node:assert/strict'
import test from 'node:test'

import {
  _resetInMemoryBudget,
  commitCredits,
  getBudgetStatus,
  releaseCredits,
  reserveCredits,
} from '../lib/server/budget.ts'

test('budget reservations respect hard limit and track usage', async () => {
  _resetInMemoryBudget(10)

  const status0 = await getBudgetStatus()
  assert.equal(status0.totalLimit, 10)
  assert.equal(status0.remainingCredits, 10)

  // Reserve 4 credits
  const res1 = await reserveCredits('daily_price', 4, '/v2/daily/BBCA/')
  assert.ok(res1.ok)

  const status1 = await getBudgetStatus()
  assert.equal(status1.reservedCredits, 4)
  assert.equal(status1.remainingCredits, 6)

  // Reserve another 4 credits
  const res2 = await reserveCredits('company_report', 4, '/v2/company/report/BBRI/')
  assert.ok(res2.ok)

  // Try to reserve 3 credits (4 + 4 + 3 = 11 > 10) -> Should fail!
  const res3 = await reserveCredits('filings', 3, '/v2/filings/')
  assert.equal(res3.ok, false)
  assert.match(res3.error, /Anggaran API habis/)

  // Commit res1 (used 4 credits)
  await commitCredits(res1.requestId, 4, 200, 150)
  const status2 = await getBudgetStatus()
  assert.equal(status2.usedCredits, 4)
  assert.equal(status2.reservedCredits, 4)
  assert.equal(status2.remainingCredits, 2)

  // Release res2 (cancelled/failed)
  await releaseCredits(res2.requestId, 'FAILED', 500, 100)
  const status3 = await getBudgetStatus()
  assert.equal(status3.usedCredits, 4)
  assert.equal(status3.reservedCredits, 0)
  assert.equal(status3.remainingCredits, 6)

  // Now reserving 3 credits should succeed!
  const res4 = await reserveCredits('filings', 3, '/v2/filings/')
  assert.ok(res4.ok)
})

test('reserveCredits falls back to in-memory reservation when database is unreachable', async () => {
  _resetInMemoryBudget(10)
  const originalDbUrl = process.env.DATABASE_URL
  process.env.DATABASE_URL = 'postgresql://fake:fake@127.0.0.1:5433/fake_db'

  try {
    const res = await reserveCredits('daily_price', 2, '/v2/daily/BBCA/')
    assert.equal(res.ok, true)
    assert.ok(res.requestId)

    const status = await getBudgetStatus()
    assert.equal(status.reservedCredits, 2)
    assert.equal(status.remainingCredits, 8)
  } finally {
    process.env.DATABASE_URL = originalDbUrl
  }
})
