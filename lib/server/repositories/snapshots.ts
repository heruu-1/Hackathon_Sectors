import { desc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { analysisSnapshots } from '@/db/schema'
import type { AnalysisSnapshot } from '@/lib/contracts/analysis'

const inMemorySnapshots = new Map<string, AnalysisSnapshot>()

export async function getSnapshotById(id: string): Promise<AnalysisSnapshot | null> {
  try {
    const rows = await db
      .select()
      .from(analysisSnapshots)
      .where(eq(analysisSnapshots.id, id))
      .limit(1)

    if (!rows.length) return null
    return rows[0].payload as AnalysisSnapshot
  } catch {
    return inMemorySnapshots.get(id) ?? null
  }
}

export async function getLatestSnapshotByTicker(ticker: string): Promise<AnalysisSnapshot | null> {
  const cleanTicker = ticker.trim().toUpperCase().replace(/\.JK$/i, '')
  try {
    const rows = await db
      .select()
      .from(analysisSnapshots)
      .where(eq(analysisSnapshots.ticker, cleanTicker))
      .orderBy(desc(analysisSnapshots.createdAt))
      .limit(1)

    if (!rows.length) return null
    return rows[0].payload as AnalysisSnapshot
  } catch {
    const matches = Array.from(inMemorySnapshots.values())
      .filter((s) => s.ticker === cleanTicker)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return matches[0] ?? null
  }
}

export async function insertSnapshot(snapshot: AnalysisSnapshot): Promise<void> {
  try {
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
  } catch {
    inMemorySnapshots.set(snapshot.id, snapshot)
  }
}

export async function getRecentPublicSnapshots(limit = 10): Promise<AnalysisSnapshot[]> {
  try {
    const rows = await db
      .select()
      .from(analysisSnapshots)
      .orderBy(desc(analysisSnapshots.createdAt))
      .limit(limit)

    return rows.map((r) => r.payload as AnalysisSnapshot)
  } catch {
    return Array.from(inMemorySnapshots.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
  }
}
