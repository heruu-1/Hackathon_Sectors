'use server'

import { type HistoryListResult, deleteHistory, getHistory } from '@/lib/server/services/history'

import { getCurrentUserId } from './shared'

export async function getUserHistoryAction(options?: {
  ticker?: string
  limit?: number
  offset?: number
}): Promise<{ success: boolean; data?: HistoryListResult; error?: string }> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      success: false,
      error: 'AUTH_REQUIRED: Masuk dengan Google untuk melihat riwayat analisis.',
    }
  }
  const result = await getHistory(userId, options)
  if (!result.ok) return { success: false, error: result.error.message }
  return { success: true, data: result.data }
}

export async function deleteHistoryAction(
  id: number,
): Promise<{ success: boolean; error?: string }> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      success: false,
      error: 'AUTH_REQUIRED: Masuk dengan Google untuk menghapus riwayat.',
    }
  }
  const result = await deleteHistory(userId, id)
  if (!result.ok) return { success: false, error: result.error.message }
  return { success: true }
}
