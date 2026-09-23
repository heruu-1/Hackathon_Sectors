import { and, desc, eq, sql } from 'drizzle-orm'

import type { AnalysisSnapshot } from '@/lib/contracts/analysis'

import { db } from '../../../db/index.ts'
import { analysisHistory, analysisSnapshots } from '../../../db/schema.ts'

export interface HistoryItemDTO {
  id: number
  snapshotId: string
  ticker: string
  createdAt: string
  snapshot: AnalysisSnapshot | null
}

export async function getUserHistory(
  userId: string,
  options?: { ticker?: string; limit?: number; offset?: number },
): Promise<{ items: HistoryItemDTO[]; total: number }> {
  if (!userId) return { items: [], total: 0 }

  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 50)
  const offset = Math.max(options?.offset ?? 0, 0)
  const cleanTicker = options?.ticker?.trim().toUpperCase().replace(/\.JK$/i, '')

  const whereClause = cleanTicker
    ? and(eq(analysisHistory.userId, userId), eq(analysisHistory.ticker, cleanTicker))
    : eq(analysisHistory.userId, userId)

  const [totalRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(analysisHistory)
    .where(whereClause)

  const total = totalRes?.count ?? 0

  const rows = await db
    .select({
      id: analysisHistory.id,
      snapshotId: analysisHistory.snapshotId,
      ticker: analysisHistory.ticker,
      createdAt: analysisHistory.createdAt,
      payload: analysisSnapshots.payload,
    })
    .from(analysisHistory)
    .leftJoin(analysisSnapshots, eq(analysisHistory.snapshotId, analysisSnapshots.id))
    .where(whereClause)
    .orderBy(desc(analysisHistory.createdAt), desc(analysisHistory.id))
    .limit(limit)
    .offset(offset)

  const items: HistoryItemDTO[] = rows.map((r) => ({
    id: r.id,
    snapshotId: r.snapshotId,
    ticker: r.ticker,
    createdAt: r.createdAt.toISOString(),
    snapshot: (r.payload as AnalysisSnapshot) ?? null,
  }))

  return { items, total }
}

export async function addHistoryEntry(
  userId: string,
  snapshotId: string,
  ticker: string,
): Promise<number> {
  const cleanTicker = ticker.trim().toUpperCase().replace(/\.JK$/i, '')
  const [row] = await db
    .insert(analysisHistory)
    .values({
      userId,
      snapshotId,
      ticker: cleanTicker,
      createdAt: new Date(),
    })
    .onConflictDoNothing({
      target: [analysisHistory.userId, analysisHistory.snapshotId],
    })
    .returning()

  return row?.id ?? 0
}

export async function deleteHistoryEntry(userId: string, id: number): Promise<boolean> {
  if (!userId) return false
  const rows = await db
    .delete(analysisHistory)
    .where(and(eq(analysisHistory.id, id), eq(analysisHistory.userId, userId)))
    .returning()

  return rows.length > 0
}

export async function getHistorySnapshot(
  userId: string,
  snapshotId: string,
): Promise<AnalysisSnapshot | null> {
  if (!userId) return null
  const rows = await db
    .select({ payload: analysisSnapshots.payload })
    .from(analysisHistory)
    .innerJoin(analysisSnapshots, eq(analysisHistory.snapshotId, analysisSnapshots.id))
    .where(and(eq(analysisHistory.userId, userId), eq(analysisHistory.snapshotId, snapshotId)))
    .limit(1)

  return rows.length ? (rows[0].payload as AnalysisSnapshot) : null
}
