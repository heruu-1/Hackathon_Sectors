import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ServerEnvSchema, maskSecret } from '../lib/server/env.ts'

test('ServerEnv: passes with valid development environment', () => {
  const validDev = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgres://rasi:secret@localhost:5433/rasi',
    BETTER_AUTH_SECRET: 'this-is-a-valid-32-char-secret-key-ok!',
    BETTER_AUTH_URL: 'http://localhost:3000',
    GEMINI_MODEL: 'gemini-3.5-flash-lite',
  }
  const result = ServerEnvSchema.safeParse(validDev)
  assert.equal(result.success, true)
})

test('ServerEnv: rejects secret shorter than 32 characters', () => {
  const shortSecret = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgres://rasi:secret@localhost:5433/rasi',
    BETTER_AUTH_SECRET: 'too-short',
    BETTER_AUTH_URL: 'http://localhost:3000',
  }
  const result = ServerEnvSchema.safeParse(shortSecret)
  assert.equal(result.success, false)
  assert.ok(result.error?.issues.some((i) => i.message.includes('32 karakter')))
})

test('ServerEnv: rejects placeholder secret in production', () => {
  const prodPlaceholder = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://rasi:secret@prod-host:5432/rasi',
    BETTER_AUTH_SECRET: 'rasi-development-secret-change-this-before-deployment-32-chars',
    BETTER_AUTH_URL: 'https://rasi.app',
  }
  const result = ServerEnvSchema.safeParse(prodPlaceholder)
  assert.equal(result.success, false)
  assert.ok(result.error?.issues.some((i) => i.message.includes('placeholder')))
})

test('ServerEnv: rejects non-HTTPS URL in production', () => {
  const prodHttp = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://rasi:secret@prod-host:5432/rasi',
    BETTER_AUTH_SECRET: 'super-secure-production-secret-key-32-chars-long!',
    BETTER_AUTH_URL: 'http://rasi.app',
  }
  const result = ServerEnvSchema.safeParse(prodHttp)
  assert.equal(result.success, false)
  assert.ok(result.error?.issues.some((i) => i.message.includes('HTTPS')))
})

test('ServerEnv: rejects Google Client ID without Secret', () => {
  const unpaired = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgres://rasi:secret@localhost:5433/rasi',
    BETTER_AUTH_SECRET: 'this-is-a-valid-32-char-secret-key-ok!',
    BETTER_AUTH_URL: 'http://localhost:3000',
    GOOGLE_CLIENT_ID: 'google-client-id-123',
  }
  const result = ServerEnvSchema.safeParse(unpaired)
  assert.equal(result.success, false)
  assert.ok(result.error?.issues.some((i) => i.message.includes('berpasangan')))
})

test('ServerEnv: rejects unallowlisted Gemini model', () => {
  const invalidModel = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgres://rasi:secret@localhost:5433/rasi',
    BETTER_AUTH_SECRET: 'this-is-a-valid-32-char-secret-key-ok!',
    BETTER_AUTH_URL: 'http://localhost:3000',
    GEMINI_MODEL: 'gemini-1.5-pro',
  }
  const result = ServerEnvSchema.safeParse(invalidModel)
  assert.equal(result.success, false)
  assert.ok(result.error?.issues.some((i) => i.path.includes('GEMINI_MODEL')))
})

test('ServerEnv: rejects Assistant enabled without Gemini API Key', () => {
  const missingAiKey = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgres://rasi:secret@localhost:5433/rasi',
    BETTER_AUTH_SECRET: 'this-is-a-valid-32-char-secret-key-ok!',
    BETTER_AUTH_URL: 'http://localhost:3000',
    RASI_ASSISTANT_ENABLED: 'true',
  }
  const result = ServerEnvSchema.safeParse(missingAiKey)
  assert.equal(result.success, false)
  assert.ok(result.error?.issues.some((i) => i.path.includes('GEMINI_API_KEY')))
})

test('ServerEnv: in production rejects active analysis or assistant when budget is zero', () => {
  const zeroBudgetProd = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://rasi:secret@prod-host:5432/rasi',
    BETTER_AUTH_SECRET: 'super-secure-production-secret-key-32-chars-long!',
    BETTER_AUTH_URL: 'https://rasi.app',
    RASI_ANALYSIS_ENABLED: 'true',
    SECTORS_API_KEY: 'sectors-real-key-123',
    SECTORS_DAILY_CREDIT_BUDGET: 0,
  }
  const result = ServerEnvSchema.safeParse(zeroBudgetProd)
  assert.equal(result.success, false)
  assert.ok(result.error?.issues.some((i) => i.path.includes('SECTORS_DAILY_CREDIT_BUDGET')))
})

test('maskSecret: never reveals raw secret value', () => {
  const secret = 'super-secret-key-1234567890'
  const masked = maskSecret(secret)
  assert.equal(masked, `[TERISI - ${secret.length} karakter]`)
  assert.equal(masked.includes(secret), false)
  assert.equal(maskSecret(''), '[KOSONG]')
  assert.equal(maskSecret('your_secret_here'), '[PLACEHOLDER DITOLAK]')
})
