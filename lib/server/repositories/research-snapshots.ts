import { desc, eq } from 'drizzle-orm'

import { db } from '../../../db/index.ts'
import { type ResearchSnapshotRow, researchSnapshots } from '../../../db/schema.ts'
import { isDbTemporarilyUnavailable, markDbUnavailable } from '../cache.ts'

export async function insertResearchSnapshot(snapshot: {
  id?: string
  ticker: string
  companyName?: string
  schemaVersion: string
  ruleVersion: string
  marketCutoffDate: string
  payload: Record<string, unknown>
}): Promise<ResearchSnapshotRow> {
  const id = snapshot.id || crypto.randomUUID()

  if (process.env.DATABASE_URL && !isDbTemporarilyUnavailable()) {
    try {
      const [inserted] = await db
        .insert(researchSnapshots)
        .values({
          id,
          ticker: snapshot.ticker,
          companyName: snapshot.companyName ?? snapshot.ticker,
          schemaVersion: snapshot.schemaVersion,
          ruleVersion: snapshot.ruleVersion,
          marketCutoffDate: snapshot.marketCutoffDate,
          payload: snapshot.payload,
          createdAt: new Date(),
        })
        .returning()

      if (inserted) return inserted
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes('ECONNREFUSED') || err.message.includes('connect'))
      ) {
        markDbUnavailable()
      }
      // Fallback to memory
    }
  }

  // In-memory fallback
  return {
    id,
    ticker: snapshot.ticker,
    companyName: snapshot.companyName ?? snapshot.ticker,
    schemaVersion: snapshot.schemaVersion,
    ruleVersion: snapshot.ruleVersion,
    marketCutoffDate: snapshot.marketCutoffDate,
    payload: snapshot.payload,
    createdAt: new Date(),
  }
}

export async function getResearchSnapshotById(id: string): Promise<ResearchSnapshotRow | null> {
  if (process.env.DATABASE_URL && !isDbTemporarilyUnavailable()) {
    try {
      const [row] = await db
        .select()
        .from(researchSnapshots)
        .where(eq(researchSnapshots.id, id))
        .limit(1)

      return row ?? null
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
  return null
}

export async function getLatestResearchSnapshotForTicker(
  ticker: string,
): Promise<ResearchSnapshotRow | null> {
  if (process.env.DATABASE_URL && !isDbTemporarilyUnavailable()) {
    try {
      const [row] = await db
        .select()
        .from(researchSnapshots)
        .where(eq(researchSnapshots.ticker, ticker))
        .orderBy(desc(researchSnapshots.createdAt))
        .limit(1)

      return row ?? null
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
  return null
}

export async function getResearchSnapshotsForTicker(
  ticker: string,
  limit = 10,
): Promise<ResearchSnapshotRow[]> {
  if (process.env.DATABASE_URL && !isDbTemporarilyUnavailable()) {
    try {
      const rows = await db
        .select()
        .from(researchSnapshots)
        .where(eq(researchSnapshots.ticker, ticker))
        .orderBy(desc(researchSnapshots.createdAt))
        .limit(limit)

      return rows
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
  return []
}
