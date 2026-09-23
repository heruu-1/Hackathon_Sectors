import { sql } from 'drizzle-orm'

import { db } from '../../db/index.ts'
import { quotaBuckets } from '../../db/schema.ts'
import type { Result } from '../contracts/result.ts'
import { errorResult, successResult } from '../contracts/result.ts'

export interface QuotaConfig {
  perMinute: number
  perDay: number
}

export const OPERATION_LIMITS: Record<string, QuotaConfig> = {
  assistant: {
    perMinute: Number(process.env.ASSISTANT_LIMIT_PER_MINUTE) || 15,
    perDay: Number(process.env.ASSISTANT_LIMIT_PER_DAY) || 1500,
  },
  analysis: {
    perMinute: Number(process.env.ANALYSIS_LIMIT_PER_MINUTE) || 15,
    perDay: Number(process.env.ANALYSIS_LIMIT_PER_DAY) || 1500,
  },
  screener: { perMinute: 30, perDay: 300 },
  signal_analysis: { perMinute: 2, perDay: 20 },
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

const inMemoryQuotaBuckets = new Map<string, number>()

function consumeInMemoryQuota(
  subject: string,
  operation: string,
  config: QuotaConfig,
  now: Date,
): Result<{ remainingToday: number; remainingMinute: number }> {
  const minuteKey = `${subject}:min:${now.toISOString().slice(0, 16)}`
  const dayKey = `${subject}:day:${now.toISOString().slice(0, 10)}`

  const currentMin = (inMemoryQuotaBuckets.get(minuteKey) ?? 0) + 1
  inMemoryQuotaBuckets.set(minuteKey, currentMin)

  if (currentMin > config.perMinute) {
    return errorResult(
      'RATE_LIMITED',
      `Batas ${config.perMinute} permintaan per menit tercapai. Tunggu sebentar lalu coba lagi.`,
      { retryAfterSeconds: 60 - now.getSeconds() },
    )
  }

  const currentDay = (inMemoryQuotaBuckets.get(dayKey) ?? 0) + 1
  inMemoryQuotaBuckets.set(dayKey, currentDay)

  if (currentDay > config.perDay) {
    return errorResult(
      'RATE_LIMITED',
      `Batas kuota harian (${config.perDay} per hari) untuk fitur ${operation} telah tercapai.`,
    )
  }

  return successResult({
    remainingToday: Math.max(0, config.perDay - currentDay),
    remainingMinute: Math.max(0, config.perMinute - currentMin),
  })
}

/**
 * Checks and atomically increments quota buckets in PostgreSQL.
 * If limit is exceeded, returns RATE_LIMITED or BUDGET_EXHAUSTED.
 * Falls back to in-memory tracking if database is unavailable.
 */
export async function consumeQuota(
  subject: string,
  operation: 'assistant' | 'analysis' | 'screener' | 'signal_analysis',
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
  } catch {
    if (process.env.NODE_ENV === 'production') {
      return errorResult(
        'DATABASE_UNAVAILABLE',
        'Layanan kuota database tidak dapat diakses saat ini.',
      )
    }
    // Fallback to in-memory quota tracking when database is unreachable in non-prod
    return consumeInMemoryQuota(subject, operation, config, now)
  }
}
