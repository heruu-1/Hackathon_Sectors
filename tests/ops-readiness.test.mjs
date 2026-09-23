import assert from 'node:assert/strict'
import test from 'node:test'

import { GET as getLive } from '../app/api/live/route.ts'
import { logger, sanitizeMetadata, sanitizeUserId } from '../lib/server/logger.ts'

test('liveness probe: /api/live returns HTTP 200 and LIVE status', async () => {
  const response = await getLive()
  assert.equal(response.status, 200)

  const body = await response.json()
  assert.equal(body.status, 'LIVE')
  assert.equal(typeof body.uptime, 'number')
  assert.ok(body.timestamp)
  assert.equal(body.service, 'rasi')
  assert.equal(response.headers.get('Cache-Control'), 'no-store, no-cache, must-revalidate')
})

test('observability: sanitizeUserId anonymizes user IDs using deterministic prefix', () => {
  assert.equal(sanitizeUserId(''), 'anonymous')
  assert.equal(sanitizeUserId(null), 'anonymous')
  assert.equal(sanitizeUserId(undefined), 'anonymous')

  const hash1 = sanitizeUserId('user-12345')
  const hash2 = sanitizeUserId('user-12345')
  const hash3 = sanitizeUserId('user-99999')

  assert.ok(hash1.startsWith('usr_'))
  assert.equal(hash1.length, 16) // usr_ (4) + 12 hex = 16
  assert.equal(hash1, hash2, 'Identical user IDs must produce identical sanitized tokens')
  assert.notEqual(hash1, hash3, 'Different user IDs must produce distinct sanitized tokens')
  assert.ok(!hash1.includes('12345'), 'Sanitized token must not leak the raw user ID')
})

test('observability: sanitizeMetadata redacts credentials, passwords, and sensitive keys', () => {
  const input = {
    apiKey: 'secret-key-123',
    password: 'SuperSecretPassword!',
    authorization: 'Bearer jwt.token.here',
    nested: {
      clientSecret: 'shhh-secret',
      userId: 'user-alice-777',
      normalField: 'BBCA',
    },
  }

  const sanitized = sanitizeMetadata(input)
  assert.equal(sanitized.apiKey, '[REDACTED]')
  assert.equal(sanitized.password, '[REDACTED]')
  assert.equal(sanitized.authorization, '[REDACTED]')

  const nested = sanitized.nested
  assert.equal(nested.clientSecret, '[REDACTED]')
  assert.equal(nested.normalField, 'BBCA')
  assert.ok(String(nested.userId).startsWith('usr_'))
  assert.ok(!String(nested.userId).includes('alice'))
})

test('observability: logger outputs without throwing', () => {
  // Verify logger does not throw on various log levels
  assert.doesNotThrow(() => logger.info('Test info message', { ticker: 'BBRI' }))
  assert.doesNotThrow(() => logger.warn('Test warning message', { retryCount: 2 }))
  assert.doesNotThrow(() =>
    logger.error('Test error message', new Error('Simulated failure'), { context: 'test' }),
  )
})
