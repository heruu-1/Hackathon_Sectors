import { desc, eq } from 'drizzle-orm'

import { db } from '../../../db/index.ts'
import { type SignalOutcomeRow, signalOutcomes } from '../../../db/schema.ts'
import type { SignalOutcomeEvaluation } from '../../../domain/signal-outcomes.ts'

const inMemorySignalOutcomes: SignalOutcomeRow[] = []

export async function upsertSignalOutcome(outcome: SignalOutcomeEvaluation): Promise<void> {
  if (process.env.DATABASE_URL) {
    try {
      await db
        .insert(signalOutcomes)
        .values({
          snapshotId: outcome.snapshotId,
          ruleId: outcome.ruleId,
          ruleVersion: outcome.ruleVersion,
          ticker: outcome.ticker,
          horizon: outcome.horizon,
          signalDate: outcome.signalDate,
          targetDate: outcome.targetDate,
          initialPrice: outcome.initialPrice,
          targetPrice: outcome.targetPrice,
          returnFraction: outcome.returnFraction,
          status: outcome.status,
          createdAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            signalOutcomes.snapshotId,
            signalOutcomes.ruleId,
            signalOutcomes.horizon,
            signalOutcomes.ruleVersion,
          ],
          set: {
            targetDate: outcome.targetDate,
            targetPrice: outcome.targetPrice,
            returnFraction: outcome.returnFraction,
            status: outcome.status,
          },
        })
      return
    } catch {
      // Fallback
    }
  }

  // In-memory fallback
  const idx = inMemorySignalOutcomes.findIndex(
    (o) =>
      o.snapshotId === outcome.snapshotId &&
      o.ruleId === outcome.ruleId &&
      o.horizon === outcome.horizon &&
      o.ruleVersion === outcome.ruleVersion,
  )

  const row: SignalOutcomeRow = {
    id: idx >= 0 ? inMemorySignalOutcomes[idx].id : inMemorySignalOutcomes.length + 1,
    snapshotId: outcome.snapshotId,
    ruleId: outcome.ruleId,
    ruleVersion: outcome.ruleVersion,
    ticker: outcome.ticker,
    horizon: outcome.horizon,
    signalDate: outcome.signalDate,
    targetDate: outcome.targetDate,
    initialPrice: outcome.initialPrice,
    targetPrice: outcome.targetPrice,
    returnFraction: outcome.returnFraction,
    status: outcome.status,
    createdAt: new Date(),
  }

  if (idx >= 0) {
    inMemorySignalOutcomes[idx] = row
  } else {
    inMemorySignalOutcomes.push(row)
  }
}

export async function getSignalOutcomesForTicker(ticker: string): Promise<SignalOutcomeRow[]> {
  const cleanTicker = ticker.trim().toUpperCase()

  if (process.env.DATABASE_URL) {
    try {
      const rows = await db
        .select()
        .from(signalOutcomes)
        .where(eq(signalOutcomes.ticker, cleanTicker))
        .orderBy(desc(signalOutcomes.signalDate), signalOutcomes.horizon)

      return rows
    } catch {
      // Fallback
    }
  }

  return inMemorySignalOutcomes
    .filter((o) => o.ticker === cleanTicker)
    .sort((a, b) => b.signalDate.localeCompare(a.signalDate) || a.horizon - b.horizon)
}
