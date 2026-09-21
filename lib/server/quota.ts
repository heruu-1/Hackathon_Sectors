import { sql } from 'drizzle-orm'

import { db } from '@/db'
import { quotaBuckets } from '@/db/schema'
import type { Result } from '@/lib/contracts/result'
import { errorResult, successResult } from '@/lib/contracts/result'

export interface QuotaConfig {
  perMinute: number
  perDay: number
}

export const OPERATION_LIMITS: Record<string, QuotaConfig> = {
  assistant: { perMinute: 5, perDay: 20 },
  analysis: { perMinute: 3, perDay: 10 },
  screener: { perMinute: 30, perDay: 300 },
}

/**
 * Returns the start of the current day in WIB (Asia/Jakarta, UTC+7).
 */
export function getWibDayStart(date = new Date()): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [year, month, day] = formatter.format(date).split('-').map(Number)
  // WIB is UTC+7, so midnight WIB is 17:00 UTC previous day
  return new Date(Date.UTC(year, month - 1, day, -7, 0, 0, 0))
}

/**
 * Returns the start of the current minute in UTC.
 */
export function getMinuteStart(date = new Date()): Date {
  const d = new Date(date)
  d.setSeconds(0, 0)
  return d
}

/**
 * Checks and atomically increments quota buckets in PostgreSQL.
 * If limit is exceeded, returns RATE_LIMITED or BUDGET_EXHAUSTED.
 */
export async function consumeQuota(
  subject: string,
  operation: 'assistant' | 'analysis' | 'screener',
  customConfig?: Partial<QuotaConfig>,
): Promise<Result<{ remainingToday: number; remainingMinute: number }>> {
  const config: QuotaConfig = {
    ...OPERATION_LIMITS[operation],
    ...customConfig,
  }

  const now = new Date()
  const minuteStart = getMinuteStart(now)
  const dayStart = getWibDayStart(now)

  try {
    // 1. Check & increment minute bucket
    const minuteKey = `${subject}:min`
    const [minuteRow] = await db
      .insert(quotaBuckets)
      .values({
        subject: minuteKey,
        operation,
        windowStart: minuteStart,
        count: 1,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [quotaBuckets.subject, quotaBuckets.operation, quotaBuckets.windowStart],
        set: {
          count: sql`${quotaBuckets.count} + 1`,
          updatedAt: now,
        },
      })
      .returning()

    if (minuteRow.count > config.perMinute) {
      return errorResult(
        'RATE_LIMITED',
        `Batas ${config.perMinute} permintaan per menit tercapai. Tunggu sebentar lalu coba lagi.`,
        { retryAfterSeconds: 60 - now.getSeconds() },
      )
    }

    // 2. Check & increment daily bucket
    const dayKey = `${subject}:day`
    const [dayRow] = await db
      .insert(quotaBuckets)
      .values({
        subject: dayKey,
        operation,
        windowStart: dayStart,
        count: 1,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [quotaBuckets.subject, quotaBuckets.operation, quotaBuckets.windowStart],
        set: {
          count: sql`${quotaBuckets.count} + 1`,
          updatedAt: now,
        },
      })
      .returning()

    if (dayRow.count > config.perDay) {
      return errorResult(
        'RATE_LIMITED',
        `Batas kuota harian (${config.perDay} per hari WIB) untuk fitur ${operation} telah tercapai. Coba lagi besok setelah pukul 00:00 WIB.`,
      )
    }

    return successResult({
      remainingToday: Math.max(0, config.perDay - dayRow.count),
      remainingMinute: Math.max(0, config.perMinute - minuteRow.count),
    })
  } catch (error) {
    // If database is unavailable, fail safe: do not allow new calls
    const message = error instanceof Error ? error.message : 'Database kuota tidak tersedia.'
    return errorResult('DATABASE_UNAVAILABLE', `Gagal memeriksa kuota: ${message}`)
  }
}
