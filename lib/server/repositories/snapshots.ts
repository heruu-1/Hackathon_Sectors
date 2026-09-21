import { desc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { analysisSnapshots } from '@/db/schema'
import type { AnalysisSnapshot } from '@/lib/contracts/analysis'

export async function getSnapshotById(id: string): Promise<AnalysisSnapshot | null> {
  const rows = await db
    .select()
    .from(analysisSnapshots)
    .where(eq(analysisSnapshots.id, id))
    .limit(1)

  if (!rows.length) return null
  return rows[0].payload as AnalysisSnapshot
}

export async function getLatestSnapshotByTicker(ticker: string): Promise<AnalysisSnapshot | null> {
  const cleanTicker = ticker.trim().toUpperCase().replace(/\.JK$/i, '')
  const rows = await db
    .select()
    .from(analysisSnapshots)
    .where(eq(analysisSnapshots.ticker, cleanTicker))
    .orderBy(desc(analysisSnapshots.createdAt))
    .limit(1)

  if (!rows.length) return null
  return rows[0].payload as AnalysisSnapshot
}

export async function insertSnapshot(snapshot: AnalysisSnapshot): Promise<void> {
  await db.insert(analysisSnapshots).values({
    id: snapshot.id,
    ticker: snapshot.ticker,
    companyName: snapshot.companyName,
    schemaVersion: snapshot.schemaVersion,
    ruleVersion: snapshot.ruleVersion,
    price: snapshot.price,
    priceChangeFraction: snapshot.priceChangeFraction,
    priceDate: snapshot.priceDate,
    payload: snapshot,
    createdAt: new Date(snapshot.createdAt),
  })
}

export async function getRecentPublicSnapshots(limit = 10): Promise<AnalysisSnapshot[]> {
  const rows = await db
    .select()
    .from(analysisSnapshots)
    .orderBy(desc(analysisSnapshots.createdAt))
    .limit(limit)

  return rows.map((r) => r.payload as AnalysisSnapshot)
}
