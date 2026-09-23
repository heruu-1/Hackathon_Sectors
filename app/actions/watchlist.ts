'use server'

import type { WatchlistItemDTO } from '@/lib/contracts/watchlist'
import { deleteWatchlistItem as deleteWatchlistRepoItem } from '@/lib/server/repositories/watchlist'
import {
  addToWatchlist as addToWatchlistService,
  getWatchlist as getWatchlistService,
  removeFromWatchlist as removeFromWatchlistService,
} from '@/lib/server/services/watchlist'

import {
  getCurrentUserId,
  parseOptionalPriority,
  parseOptionalStatus,
  parsePriority,
  parseStatus,
} from './shared'

export async function getWatchlist(): Promise<{
  success: boolean
  data?: WatchlistItemDTO[]
  error?: string
}> {
  const userId = await getCurrentUserId()
  if (!userId) return { success: true, data: [] }
  const result = await getWatchlistService(userId)
  if (!result.ok) return { success: false, error: result.error.message }
  return { success: true, data: result.data }
}

export async function addToWatchlist(item: {
  ticker: string
  name?: string
  targetPrice?: number | string
  notes?: string
  priority?: string
  status?: string
  lastPrice?: number | string
  lastChange?: number | string
}) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      success: false,
      error: 'AUTH_REQUIRED: Masuk dengan Google untuk menyimpan pantauan.',
    }
  }

  const numTargetPrice =
    typeof item.targetPrice === 'string' ? parseFloat(item.targetPrice) : item.targetPrice
  const numLastPrice =
    typeof item.lastPrice === 'string' ? parseFloat(item.lastPrice) : item.lastPrice
  const numLastChange =
    typeof item.lastChange === 'string'
      ? parseFloat(item.lastChange.replace('%', '')) / 100
      : item.lastChange

  const priority = parsePriority(item.priority)
  const status = parseStatus(item.status)

  const result = await addToWatchlistService(userId, {
    ticker: item.ticker,
    name: item.name,
    targetPrice: Number.isFinite(numTargetPrice) ? numTargetPrice : null,
    notes: item.notes ?? null,
    priority,
    status,
    lastPrice: Number.isFinite(numLastPrice) ? numLastPrice : null,
    lastChange: Number.isFinite(numLastChange) ? numLastChange : null,
  })

  if (!result.ok) return { success: false, error: result.error.message }
  return { success: true, data: result.data, isNew: true }
}

export async function updateWatchlistItem(
  id: number,
  updates: {
    targetPrice?: number | string | null
    notes?: string | null
    priority?: string
    status?: string
  },
) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      success: false,
      error: 'AUTH_REQUIRED: Masuk dengan Google untuk mengubah pantauan.',
    }
  }

  const numTargetPrice =
    typeof updates.targetPrice === 'string' ? parseFloat(updates.targetPrice) : updates.targetPrice

  const priority = parseOptionalPriority(updates.priority)
  const status = parseOptionalStatus(updates.status)

  const { updateWatchlistItem: updateRepoItem } =
    await import('@/lib/server/repositories/watchlist')
  const updated = await updateRepoItem(userId, id, {
    targetPrice: Number.isFinite(numTargetPrice) ? numTargetPrice : null,
    notes: updates.notes ?? null,
    priority,
    status,
  })

  if (!updated) return { success: false, error: 'Pantauan tidak ditemukan.' }
  return { success: true, data: updated }
}

export async function deleteWatchlistItem(idOrTicker: number | string) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      success: false,
      error: 'AUTH_REQUIRED: Masuk dengan Google untuk menghapus pantauan.',
    }
  }

  if (typeof idOrTicker === 'string') {
    const result = await removeFromWatchlistService(userId, idOrTicker)
    if (!result.ok) return { success: false, error: result.error.message }
    return { success: true, id: idOrTicker }
  }

  const deleted = await deleteWatchlistRepoItem(userId, idOrTicker)
  if (!deleted) return { success: false, error: 'Pantauan tidak ditemukan.' }
  return { success: true, id: idOrTicker }
}
