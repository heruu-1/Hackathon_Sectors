import { and, eq, sql } from 'drizzle-orm'

import { db } from '../../db/index.ts'
import { apiBudgets, apiUsage } from '../../db/schema.ts'
import { isDbTemporarilyUnavailable, markDbUnavailable } from './cache.ts'

export const DEFAULT_CAMPAIGN = 'hackathon_category_3'
export const DEFAULT_BUDGET_LIMIT = 500

// In-memory fallback for testing / when DB is offline
const inMemoryBudget = {
  totalLimit: DEFAULT_BUDGET_LIMIT,
  usedCredits: 0,
  reservedCredits: 0,
}
const inMemoryUsage = new Map<
  string,
  {
    capability: string
    creditsReserved: number
    creditsUsed: number
    status: 'RESERVED' | 'COMMITTED' | 'RELEASED' | 'FAILED'
    endpoint: string
  }
>()

let tableEnsured = false

async function ensureBudgetTables() {
  if (tableEnsured || !process.env.DATABASE_URL || isDbTemporarilyUnavailable()) return
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "api_budgets" (
        "campaign" varchar(50) PRIMARY KEY,
        "total_limit" integer NOT NULL DEFAULT 500,
        "used_credits" integer NOT NULL DEFAULT 0,
        "reserved_credits" integer NOT NULL DEFAULT 0,
        "updated_at" timestamp with time zone NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS "api_usage" (
        "id" serial PRIMARY KEY,
        "request_id" varchar(100) NOT NULL UNIQUE,
        "capability" varchar(100) NOT NULL,
        "credits_reserved" integer NOT NULL,
        "credits_used" integer NOT NULL DEFAULT 0,
        "status" varchar(50) NOT NULL,
        "endpoint" text NOT NULL,
        "status_code" integer,
        "duration_ms" integer,
        "created_at" timestamp with time zone NOT NULL DEFAULT now()
      );
    `)
    tableEnsured = true
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('ECONNREFUSED') || err.message.includes('connect'))
    ) {
      markDbUnavailable()
    }
  }
}

export async function getBudgetStatus(campaign = DEFAULT_CAMPAIGN): Promise<{
  totalLimit: number
  usedCredits: number
  reservedCredits: number
  remainingCredits: number
}> {
  if (process.env.DATABASE_URL && !isDbTemporarilyUnavailable()) {
    try {
      await ensureBudgetTables()

      let [row] = await db
        .select()
        .from(apiBudgets)
        .where(eq(apiBudgets.campaign, campaign))
        .limit(1)

      if (!row) {
        // Initialize budget row
        ;[row] = await db
          .insert(apiBudgets)
          .values({
            campaign,
            totalLimit: DEFAULT_BUDGET_LIMIT,
            usedCredits: 0,
            reservedCredits: 0,
            updatedAt: new Date(),
          })
          .onConflictDoNothing()
          .returning()
      }

      if (row) {
        const remaining = Math.max(0, row.totalLimit - (row.usedCredits + row.reservedCredits))
        return {
          totalLimit: row.totalLimit,
          usedCredits: row.usedCredits,
          reservedCredits: row.reservedCredits,
          remainingCredits: remaining,
        }
      }
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes('ECONNREFUSED') || err.message.includes('connect'))
      ) {
        markDbUnavailable()
      }
      // Fallback to in-memory on DB error
    }
  }

  const remaining = Math.max(
    0,
    inMemoryBudget.totalLimit - (inMemoryBudget.usedCredits + inMemoryBudget.reservedCredits),
  )
  return {
    totalLimit: inMemoryBudget.totalLimit,
    usedCredits: inMemoryBudget.usedCredits,
    reservedCredits: inMemoryBudget.reservedCredits,
    remainingCredits: remaining,
  }
}

export async function reserveCredits(
  capability: string,
  credits: number,
  endpoint: string,
  requestId = crypto.randomUUID(),
  campaign = DEFAULT_CAMPAIGN,
): Promise<{ ok: boolean; requestId: string; error?: string }> {
  if (credits <= 0) {
    return { ok: true, requestId }
  }

  if (process.env.DATABASE_URL && !isDbTemporarilyUnavailable()) {
    try {
      // Ensure budget tables and row exist
      await ensureBudgetTables()
      await getBudgetStatus(campaign)

      // Atomically check and reserve credits if totalLimit not exceeded
      const [updated] = await db
        .update(apiBudgets)
        .set({
          reservedCredits: sql`${apiBudgets.reservedCredits} + ${credits}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(apiBudgets.campaign, campaign),
            sql`${apiBudgets.usedCredits} + ${apiBudgets.reservedCredits} + ${credits} <= ${apiBudgets.totalLimit}`,
          ),
        )
        .returning()

      if (!updated) {
        return {
          ok: false,
          requestId,
          error: `Anggaran API habis. Permintaan ${credits} kredit melebihi sisa alokasi kampanye (${campaign}).`,
        }
      }

      // Record in api_usage
      await db
        .insert(apiUsage)
        .values({
          requestId,
          capability,
          creditsReserved: credits,
          creditsUsed: 0,
          status: 'RESERVED',
          endpoint,
          createdAt: new Date(),
        })
        .onConflictDoNothing()

      return { ok: true, requestId }
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes('ECONNREFUSED') || err.message.includes('connect'))
      ) {
        markDbUnavailable()
      }
      // Fallback gracefully to in-memory reservation if database table or connection fails
    }
  }

  // In-memory reservation
  if (
    inMemoryBudget.usedCredits + inMemoryBudget.reservedCredits + credits >
    inMemoryBudget.totalLimit
  ) {
    return {
      ok: false,
      requestId,
      error: `Anggaran API habis. Permintaan ${credits} kredit melebihi batas (${inMemoryBudget.totalLimit}).`,
    }
  }

  inMemoryBudget.reservedCredits += credits
  inMemoryUsage.set(requestId, {
    capability,
    creditsReserved: credits,
    creditsUsed: 0,
    status: 'RESERVED',
    endpoint,
  })

  return { ok: true, requestId }
}

export async function commitCredits(
  requestId: string,
  actualCredits: number,
  statusCode = 200,
  durationMs = 0,
  campaign = DEFAULT_CAMPAIGN,
): Promise<void> {
  if (process.env.DATABASE_URL && !isDbTemporarilyUnavailable()) {
    try {
      const [usage] = await db
        .select()
        .from(apiUsage)
        .where(eq(apiUsage.requestId, requestId))
        .limit(1)

      const reserved = usage?.creditsReserved ?? actualCredits

      // Atomically transfer from reserved to used credits
      await db
        .update(apiBudgets)
        .set({
          reservedCredits: sql`GREATEST(0, ${apiBudgets.reservedCredits} - ${reserved})`,
          usedCredits: sql`${apiBudgets.usedCredits} + ${actualCredits}`,
          updatedAt: new Date(),
        })
        .where(eq(apiBudgets.campaign, campaign))

      await db
        .update(apiUsage)
        .set({
          creditsUsed: actualCredits,
          status: 'COMMITTED',
          statusCode,
          durationMs,
        })
        .where(eq(apiUsage.requestId, requestId))

      return
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes('ECONNREFUSED') || err.message.includes('connect'))
      ) {
        markDbUnavailable()
      }
      // Fallback
    }
  }

  const usage = inMemoryUsage.get(requestId)
  const reserved = usage?.creditsReserved ?? actualCredits
  inMemoryBudget.reservedCredits = Math.max(0, inMemoryBudget.reservedCredits - reserved)
  inMemoryBudget.usedCredits += actualCredits
  if (usage) {
    usage.creditsUsed = actualCredits
    usage.status = 'COMMITTED'
  }
}

export async function releaseCredits(
  requestId: string,
  reason = 'FAILED',
  statusCode?: number,
  durationMs = 0,
  campaign = DEFAULT_CAMPAIGN,
): Promise<void> {
  if (process.env.DATABASE_URL && !isDbTemporarilyUnavailable()) {
    try {
      const [usage] = await db
        .select()
        .from(apiUsage)
        .where(eq(apiUsage.requestId, requestId))
        .limit(1)

      const reserved = usage?.creditsReserved ?? 0

      await db
        .update(apiBudgets)
        .set({
          reservedCredits: sql`GREATEST(0, ${apiBudgets.reservedCredits} - ${reserved})`,
          updatedAt: new Date(),
        })
        .where(eq(apiBudgets.campaign, campaign))

      await db
        .update(apiUsage)
        .set({
          status: reason === 'TIMEOUT' ? 'FAILED' : 'RELEASED',
          statusCode: statusCode ?? null,
          durationMs,
        })
        .where(eq(apiUsage.requestId, requestId))

      return
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes('ECONNREFUSED') || err.message.includes('connect'))
      ) {
        markDbUnavailable()
      }
      // Fallback
    }
  }

  const usage = inMemoryUsage.get(requestId)
  const reserved = usage?.creditsReserved ?? 0
  inMemoryBudget.reservedCredits = Math.max(0, inMemoryBudget.reservedCredits - reserved)
  if (usage) {
    usage.status = reason === 'TIMEOUT' ? 'FAILED' : 'RELEASED'
  }
}

// Reset for testing
export function _resetInMemoryBudget(limit = DEFAULT_BUDGET_LIMIT): void {
  inMemoryBudget.totalLimit = limit
  inMemoryBudget.usedCredits = 0
  inMemoryBudget.reservedCredits = 0
  inMemoryUsage.clear()
}
