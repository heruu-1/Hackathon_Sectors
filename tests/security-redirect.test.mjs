import assert from 'node:assert/strict'
import { test } from 'node:test'

import { sanitizeCallbackUrl } from '../lib/security/redirect.ts'

test('sanitizeCallbackUrl: accepts safe relative paths', () => {
  assert.equal(sanitizeCallbackUrl('/'), '/')
  assert.equal(sanitizeCallbackUrl('/saham/BBCA'), '/saham/BBCA')
  assert.equal(sanitizeCallbackUrl('/watchlist?tab=mine'), '/watchlist?tab=mine')
  assert.equal(sanitizeCallbackUrl('/pengaturan#session'), '/pengaturan#session')
})

test('sanitizeCallbackUrl: rejects external absolute URLs', () => {
  assert.equal(sanitizeCallbackUrl('https://evil.com'), '/')
  assert.equal(sanitizeCallbackUrl('http://attacker.org/steal'), '/')
  assert.equal(sanitizeCallbackUrl('https://evil.com/saham/BBCA', '/fallback'), '/fallback')
})

test('sanitizeCallbackUrl: rejects protocol-relative and scheme bypasses', () => {
  assert.equal(sanitizeCallbackUrl('//evil.com'), '/')
  assert.equal(sanitizeCallbackUrl('///evil.com'), '/')
  assert.equal(sanitizeCallbackUrl('javascript:alert(1)'), '/')
  assert.equal(sanitizeCallbackUrl('data:text/html,evil'), '/')
})

test('sanitizeCallbackUrl: rejects backslash and encoded evasions', () => {
  assert.equal(sanitizeCallbackUrl('\\evil.com'), '/')
  assert.equal(sanitizeCallbackUrl('/\\evil.com'), '/')
  assert.equal(sanitizeCallbackUrl('%2f%2fevil.com'), '/')
  assert.equal(sanitizeCallbackUrl('/%5cevil.com'), '/')
  assert.equal(sanitizeCallbackUrl('/path\\with\\backslash'), '/')
})

test('sanitizeCallbackUrl: handles null, undefined, empty, and whitespace', () => {
  assert.equal(sanitizeCallbackUrl(null), '/')
  assert.equal(sanitizeCallbackUrl(undefined), '/')
  assert.equal(sanitizeCallbackUrl(''), '/')
  assert.equal(sanitizeCallbackUrl('   '), '/')
  assert.equal(sanitizeCallbackUrl('', '/custom'), '/custom')
})
