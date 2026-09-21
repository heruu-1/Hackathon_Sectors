import { type Result, errorResult, successResult } from '../../contracts/result.ts'
import {
  AddWatchlistSchema,
  TickerSchema,
  UpdateWatchlistSchema,
  type WatchlistItemDTO,
} from '../../contracts/watchlist.ts'
import {
  deleteWatchlistItemByTicker,
  getUserWatchlist,
  updateWatchlistItemByTicker,
  upsertWatchlistItem,
} from '../repositories/watchlist.ts'

export async function getWatchlist(userId: string): Promise<Result<WatchlistItemDTO[]>> {
  if (!userId) {
    return errorResult('AUTH_REQUIRED', 'Anda harus masuk untuk melihat watchlist.')
  }
  const items = await getUserWatchlist(userId)
  return successResult(items)
}

export async function addToWatchlist(
  userId: string,
  rawInput: unknown,
): Promise<Result<WatchlistItemDTO>> {
  if (!userId) {
    return errorResult('AUTH_REQUIRED', 'Anda harus masuk untuk menambahkan ke watchlist.')
  }

  const parsed = AddWatchlistSchema.safeParse(rawInput)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Input watchlist tidak valid.'
    return errorResult('VALIDATION_ERROR', msg)
  }

  const item = await upsertWatchlistItem(userId, parsed.data)
  return successResult(item)
}

export async function updateWatchlist(
  userId: string,
  ticker: string,
  rawInput: unknown,
): Promise<Result<WatchlistItemDTO>> {
  if (!userId) {
    return errorResult('AUTH_REQUIRED', 'Anda harus masuk untuk mengubah watchlist.')
  }

  const tickerParse = TickerSchema.safeParse(ticker)
  if (!tickerParse.success) {
    return errorResult('VALIDATION_ERROR', 'Kode saham tidak valid.')
  }

  const parsed = UpdateWatchlistSchema.safeParse(rawInput)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Input perubahan watchlist tidak valid.'
    return errorResult('VALIDATION_ERROR', msg)
  }

  const updated = await updateWatchlistItemByTicker(userId, tickerParse.data, parsed.data)
  if (!updated) {
    return errorResult('NOT_FOUND', 'Saham tidak ditemukan dalam watchlist Anda.')
  }

  return successResult(updated)
}

export async function removeFromWatchlist(
  userId: string,
  ticker: string,
): Promise<Result<{ success: boolean }>> {
  if (!userId) {
    return errorResult('AUTH_REQUIRED', 'Anda harus masuk untuk menghapus dari watchlist.')
  }

  const tickerParse = TickerSchema.safeParse(ticker)
  if (!tickerParse.success) {
    return errorResult('VALIDATION_ERROR', 'Kode saham tidak valid.')
  }

  const deleted = await deleteWatchlistItemByTicker(userId, tickerParse.data)
  if (!deleted) {
    return errorResult('NOT_FOUND', 'Saham tidak ditemukan dalam watchlist Anda.')
  }

  return successResult({ success: true })
}
