import assert from 'node:assert/strict'
import { test } from 'node:test'

import { consumeQuota } from '../lib/server/quota.ts'
import {
  createConversation,
  deleteConversation,
  getConversation,
} from '../lib/server/repositories/conversations.ts'
import { sendMessage } from '../lib/server/services/assistant.ts'

test('auth: sendMessage rejects empty userId with AUTH_REQUIRED', async () => {
  const prevEnv = process.env.RASI_ASSISTANT_ENABLED
  try {
    process.env.RASI_ASSISTANT_ENABLED = 'true'
    const res = await sendMessage('', {
      message: 'Halo asisten',
      requestKey: '11111111-1111-4111-8111-111111111111',
    })
    assert.equal(res.ok, false)
    assert.equal(res.error.code, 'AUTH_REQUIRED')
  } finally {
    process.env.RASI_ASSISTANT_ENABLED = prevEnv
  }
})

test('isolation: user A cannot read or delete user B conversation', async () => {
  const userA = 'user-alice'
  const userB = 'user-bob'

  // Create conversation as Alice
  const convA = await createConversation(userA, 'Analisis Portofolio Alice', 'BBCA')
  assert.equal(convA.userId, userA)

  // Bob attempts to get Alice's conversation
  const readByBob = await getConversation(userB, convA.id)
  assert.equal(readByBob, null, 'Bob should not be able to read Alice conversation')

  // Bob attempts to delete Alice's conversation
  const deletedByBob = await deleteConversation(userB, convA.id)
  assert.equal(deletedByBob, false, 'Bob should not be able to delete Alice conversation')

  // Conversation should still exist for Alice
  const readByAlice = await getConversation(userA, convA.id)
  assert.ok(readByAlice, 'Alice conversation must remain intact')
})

test('fail-closed: in production, quota consumption fails closed with DATABASE_UNAVAILABLE when DB is unreachable', async () => {
  const origNodeEnv = process.env.NODE_ENV
  const origDbUrl = process.env.DATABASE_URL
  try {
    process.env.NODE_ENV = 'production'
    process.env.DATABASE_URL = 'postgres://invalid:5432/none'
    const res = await consumeQuota('user-test-failclosed', 'analysis')
    assert.equal(res.ok, false)
    assert.equal(res.error.code, 'DATABASE_UNAVAILABLE')
  } finally {
    process.env.NODE_ENV = origNodeEnv
    process.env.DATABASE_URL = origDbUrl
  }
})

test('fail-closed: in production, conversation creation throws DATABASE_UNAVAILABLE when DB is unreachable', async () => {
  const origNodeEnv = process.env.NODE_ENV
  const origDbUrl = process.env.DATABASE_URL
  try {
    process.env.NODE_ENV = 'production'
    process.env.DATABASE_URL = 'postgres://invalid:5432/none'
    await assert.rejects(
      async () => {
        await createConversation('user-test-failclosed', 'Percakapan Produksi')
      },
      (err) => {
        return err instanceof Error && err.message.includes('DATABASE_UNAVAILABLE')
      },
    )
  } finally {
    process.env.NODE_ENV = origNodeEnv
    process.env.DATABASE_URL = origDbUrl
  }
})
