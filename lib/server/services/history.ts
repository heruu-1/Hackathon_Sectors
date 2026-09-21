import type { AnalysisSnapshot } from '../../contracts/analysis.ts'
import { type Result, errorResult, successResult } from '../../contracts/result.ts'
import {
  type HistoryItemDTO,
  deleteHistoryEntry,
  getHistorySnapshot,
  getUserHistory,
} from '../repositories/history.ts'

export interface HistoryListResult {
  items: HistoryItemDTO[]
  total: number
  limit: number
  offset: number
}

export async function getHistory(
  userId: string,
  options?: { ticker?: string; limit?: number; offset?: number },
): Promise<Result<HistoryListResult>> {
  if (!userId) {
    return errorResult('AUTH_REQUIRED', 'Anda harus masuk untuk melihat riwayat analisis.')
  }

  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 50)
  const offset = Math.max(options?.offset ?? 0, 0)
  const cleanTicker = options?.ticker ? options.ticker.trim().toUpperCase() : undefined

  const { items, total } = await getUserHistory(userId, {
    ticker: cleanTicker,
    limit,
    offset,
  })

  return successResult({
    items,
    total,
    limit,
    offset,
  })
}

export async function getHistoryDetail(
  userId: string,
  snapshotId: string,
): Promise<Result<AnalysisSnapshot>> {
  if (!userId) {
    return errorResult('AUTH_REQUIRED', 'Anda harus masuk untuk melihat detail riwayat.')
  }

  if (!snapshotId || typeof snapshotId !== 'string') {
    return errorResult('VALIDATION_ERROR', 'ID snapshot tidak valid.')
  }

  const snapshot = await getHistorySnapshot(userId, snapshotId)
  if (!snapshot) {
    return errorResult(
      'NOT_FOUND',
      'Riwayat analisis tidak ditemukan atau tidak dapat diakses oleh akun Anda.',
    )
  }

  return successResult(snapshot)
}

export async function deleteHistory(
  userId: string,
  id: number,
): Promise<Result<{ success: boolean }>> {
  if (!userId) {
    return errorResult('AUTH_REQUIRED', 'Anda harus masuk untuk menghapus riwayat.')
  }

  if (!Number.isInteger(id) || id <= 0) {
    return errorResult('VALIDATION_ERROR', 'ID riwayat tidak valid.')
  }

  const deleted = await deleteHistoryEntry(userId, id)
  if (!deleted) {
    return errorResult('NOT_FOUND', 'Entri riwayat tidak ditemukan atau sudah dihapus.')
  }

  return successResult({ success: true })
}
