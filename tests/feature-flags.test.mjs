import assert from 'node:assert/strict'
import { test } from 'node:test'

import { HTTP_STATUS_MAP, errorResult } from '../lib/contracts/result.ts'
import { createAnalysis } from '../lib/server/services/analysis.ts'
import { sendMessage } from '../lib/server/services/assistant.ts'
import { evaluateSignalAnalysis } from '../lib/server/services/signal-analysis.ts'

test('contracts: result supports FEATURE_DISABLED with HTTP 503', () => {
  assert.equal(HTTP_STATUS_MAP.FEATURE_DISABLED, 503)
  const res = errorResult('FEATURE_DISABLED', 'Fitur dinonaktifkan')
  assert.equal(res.ok, false)
  assert.equal(res.error.code, 'FEATURE_DISABLED')
})

test('assistant service: returns FEATURE_DISABLED when RASI_ASSISTANT_ENABLED is false', async () => {
  const orig = process.env.RASI_ASSISTANT_ENABLED
  try {
    process.env.RASI_ASSISTANT_ENABLED = 'false'
    const result = await sendMessage('test-user', {
      message: 'Halo asisten',
      requestKey: 'test-req-1',
    })
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'FEATURE_DISABLED')
  } finally {
    process.env.RASI_ASSISTANT_ENABLED = orig
  }
})

test('analysis service: returns FEATURE_DISABLED when RASI_ANALYSIS_ENABLED is false', async () => {
  const orig = process.env.RASI_ANALYSIS_ENABLED
  try {
    process.env.RASI_ANALYSIS_ENABLED = 'false'
    const result = await createAnalysis({
      ticker: 'BBCA',
      userId: 'test-user',
      requestKey: 'test-analysis-1',
    })
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'FEATURE_DISABLED')
  } finally {
    process.env.RASI_ANALYSIS_ENABLED = orig
  }
})

test('signal analysis service: throws FEATURE_DISABLED when SIGNAL_ANALYSIS_ENABLED is false', async () => {
  const orig = process.env.SIGNAL_ANALYSIS_ENABLED
  try {
    process.env.SIGNAL_ANALYSIS_ENABLED = 'false'
    await assert.rejects(
      async () => {
        await evaluateSignalAnalysis({ ticker: 'BBCA' })
      },
      (err) => {
        return err instanceof Error && err.message.includes('dinonaktifkan')
      },
    )
  } finally {
    process.env.SIGNAL_ANALYSIS_ENABLED = orig
  }
})
