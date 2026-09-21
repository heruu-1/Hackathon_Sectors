import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { type WatchlistItem, watchlist } from '@/db/schema'
import type {
  AddWatchlistInput,
  UpdateWatchlistInput,
  WatchlistItemDTO,
} from '@/lib/contracts/watchlist'

function toDTO(row: WatchlistItem): WatchlistItemDTO {
  return {
    id: row.id,
    userId: row.userId ?? '',
    ticker: row.ticker,
    name: row.name,
    targetPrice: row.targetPriceNum ?? null,
    legacyTargetPrice: row.targetPrice,
    notes: row.notes,
    priority: (row.priority as WatchlistItemDTO['priority']) ?? 'MEDIUM',
    status: (row.status as WatchlistItemDTO['status']) ?? 'WATCHING',
    lastPrice: row.numericPrice ?? null,
    lastPriceDate: row.priceDate,
    lastChange: row.numericChange ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function getUserWatchlist(userId: string): Promise<WatchlistItemDTO[]> {
  if (!userId) return []
  const rows = await db
    .select()
    .from(watchlist)
    .where(eq(watchlist.userId, userId))
    .orderBy(desc(watchlist.updatedAt))

  return rows.map(toDTO)
}

export async function getWatchlistItem(
  userId: string,
  ticker: string,
): Promise<WatchlistItemDTO | null> {
  if (!userId) return null
  const cleanTicker = ticker.trim().toUpperCase().replace(/\.JK$/i, '')
  const rows = await db
    .select()
    .from(watchlist)
    .where(and(eq(watchlist.userId, userId), eq(watchlist.ticker, cleanTicker)))
    .limit(1)

  return rows.length ? toDTO(rows[0]) : null
}

export async function upsertWatchlistItem(
  userId: string,
  input: AddWatchlistInput,
): Promise<WatchlistItemDTO> {
  const cleanTicker = input.ticker.trim().toUpperCase().replace(/\.JK$/i, '')

  // Check if item exists for this user
  const existing = await getWatchlistItem(userId, cleanTicker)
  const now = new Date()

  if (existing) {
    // Preserve existing notes if not explicitly overridden
    const newNotes = input.notes !== undefined ? input.notes : existing.notes
    const newTargetPrice =
      input.targetPrice !== undefined ? input.targetPrice : existing.targetPrice

    const [updated] = await db
      .update(watchlist)
      .set({
        name: input.name ?? existing.name,
        targetPriceNum: newTargetPrice,
        notes: newNotes,
        priority: input.priority ?? existing.priority,
        status: input.status ?? existing.status,
        numericPrice: input.lastPrice ?? existing.lastPrice,
        numericChange: input.lastChange ?? existing.lastChange,
        priceDate: input.lastPriceDate ?? existing.lastPriceDate,
        updatedAt: now,
      })
      .where(and(eq(watchlist.id, existing.id), eq(watchlist.userId, userId)))
      .returning()

    return toDTO(updated)
  }

  const [inserted] = await db
    .insert(watchlist)
    .values({
      userId,
      ticker: cleanTicker,
      name: input.name ?? cleanTicker,
      targetPriceNum: input.targetPrice ?? null,
      notes: input.notes ?? null,
      priority: input.priority ?? 'MEDIUM',
      status: input.status ?? 'WATCHING',
      numericPrice: input.lastPrice ?? null,
      numericChange: input.lastChange ?? null,
      priceDate: input.lastPriceDate ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  return toDTO(inserted)
}

export async function updateWatchlistItem(
  userId: string,
  id: number,
  input: UpdateWatchlistInput,
): Promise<WatchlistItemDTO | null> {
  if (!userId) return null

  const setData: Partial<typeof watchlist.$inferInsert> = {
    updatedAt: new Date(),
  }
  if (input.targetPrice !== undefined) setData.targetPriceNum = input.targetPrice
  if (input.notes !== undefined) setData.notes = input.notes
  if (input.priority !== undefined) setData.priority = input.priority
  if (input.status !== undefined) setData.status = input.status

  const rows = await db
    .update(watchlist)
    .set(setData)
    .where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)))
    .returning()

  return rows.length ? toDTO(rows[0]) : null
}

export async function updateWatchlistItemByTicker(
  userId: string,
  ticker: string,
  input: UpdateWatchlistInput,
): Promise<WatchlistItemDTO | null> {
  if (!userId) return null
  const cleanTicker = ticker.trim().toUpperCase().replace(/\.JK$/i, '')

  const setData: Partial<typeof watchlist.$inferInsert> = {
    updatedAt: new Date(),
  }
  if (input.targetPrice !== undefined) setData.targetPriceNum = input.targetPrice
  if (input.notes !== undefined) setData.notes = input.notes
  if (input.priority !== undefined) setData.priority = input.priority
  if (input.status !== undefined) setData.status = input.status

  const rows = await db
    .update(watchlist)
    .set(setData)
    .where(and(eq(watchlist.ticker, cleanTicker), eq(watchlist.userId, userId)))
    .returning()

  return rows.length ? toDTO(rows[0]) : null
}

export async function deleteWatchlistItem(userId: string, id: number): Promise<boolean> {
  if (!userId) return false
  const rows = await db
    .delete(watchlist)
    .where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)))
    .returning()

  return rows.length > 0
}

export async function deleteWatchlistItemByTicker(
  userId: string,
  ticker: string,
): Promise<boolean> {
  if (!userId) return false
  const cleanTicker = ticker.trim().toUpperCase().replace(/\.JK$/i, '')
  const rows = await db
    .delete(watchlist)
    .where(and(eq(watchlist.ticker, cleanTicker), eq(watchlist.userId, userId)))
    .returning()

  return rows.length > 0
}
