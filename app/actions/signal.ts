'use server'

import type { Result } from '@/lib/contracts/result'
import { errorResult, successResult } from '@/lib/contracts/result'
import type { SignalAnalysisReport } from '@/lib/contracts/signal-analysis'
import { EvaluateSignalAnalysisInputSchema } from '@/lib/contracts/signal-analysis'

export async function getSignalOutcomesAction(ticker: string) {
  try {
    const { getSignalOutcomesForTicker } = await import('@/lib/server/repositories/signal-outcomes')
    const list = await getSignalOutcomesForTicker(ticker)
    return { success: true, data: list }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal memuat evaluasi sinyal.',
    }
  }
}

export async function evaluateSignalOutcomesAction(
  ticker: string,
  snapshotId: string,
  ruleId: string,
  signalDate: string,
  initialPrice: number | null,
) {
  try {
    const { fetchDailyPrices } = await import('@/lib/server/providers/sectors')
    const { evaluateSignalOutcomes } = await import('@/domain/signal-outcomes')
    const { upsertSignalOutcome, getSignalOutcomesForTicker } =
      await import('@/lib/server/repositories/signal-outcomes')

    const dailyEnvelope = await fetchDailyPrices(ticker, undefined, 30)
    const dailyRows = dailyEnvelope.data ?? []
    // Sort chronological: oldest first
    const sortedPrices = [...dailyRows].sort((a, b) => a.date.localeCompare(b.date))

    const evaluations = evaluateSignalOutcomes(
      snapshotId,
      ticker,
      ruleId,
      'rasi-mi-v2',
      signalDate,
      initialPrice,
      sortedPrices,
    )

    for (const ev of evaluations) {
      await upsertSignalOutcome(ev)
    }

    const updated = await getSignalOutcomesForTicker(ticker)
    return { success: true, data: updated }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal mengevaluasi outcome sinyal.',
    }
  }
}

export async function getSignalAnalysisAction(
  ticker: string,
): Promise<Result<SignalAnalysisReport | null>> {
  try {
    const cleanTicker = (ticker || '').trim().toUpperCase()
    if (!cleanTicker || cleanTicker.length > 10) {
      return errorResult('VALIDATION_ERROR', 'Ticker saham tidak valid.')
    }

    const { getSignalAnalysisReport } = await import('@/lib/server/services/signal-analysis')
    const report = await getSignalAnalysisReport(cleanTicker)
    return successResult(report)
  } catch (error) {
    return errorResult(
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Gagal memuat evaluasi sinyal.',
    )
  }
}

export async function evaluateSignalAnalysisAction(
  input: unknown,
): Promise<Result<SignalAnalysisReport>> {
  try {
    const parsed = EvaluateSignalAnalysisInputSchema.safeParse(input)
    if (!parsed.success) {
      return errorResult('VALIDATION_ERROR', 'Input evaluasi sinyal tidak valid.', {
        fieldErrors: parsed.error.flatten().fieldErrors as unknown as Record<string, string>,
      })
    }

    const { ticker, contextId, requestKey } = parsed.data

    const { isFeatureEnabled } = await import('@/lib/server/env')
    if (!isFeatureEnabled('SIGNAL_ANALYSIS_ENABLED')) {
      return errorResult('FEATURE_DISABLED', 'Fitur evaluasi sinyal saat ini dinonaktifkan.')
    }

    const { getOptionalSession } = await import('@/lib/server/session')
    const session = await getOptionalSession()
    if (!session?.id) {
      return errorResult('AUTH_REQUIRED', 'Anda harus masuk untuk menjalankan evaluasi sinyal.')
    }
    const userId = session.id

    // Rate limiting: 2 per minute, 20 per day
    const { consumeQuota } = await import('@/lib/server/quota')
    const quotaRes = await consumeQuota(userId, 'signal_analysis')
    if (!quotaRes.ok) {
      return quotaRes
    }

    // Idempotency deduplication
    const { withIdempotency } = await import('@/lib/server/idempotency')
    return await withIdempotency<Result<SignalAnalysisReport>>(
      userId,
      'signal_analysis',
      requestKey,
      async () => {
        const { evaluateSignalAnalysis } = await import('@/lib/server/services/signal-analysis')
        const report = await evaluateSignalAnalysis({ ticker, contextId })
        return successResult(report)
      },
    )
  } catch (error) {
    return errorResult(
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Gagal menjalankan evaluasi sinyal.',
    )
  }
}
