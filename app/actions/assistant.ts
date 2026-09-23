'use server'

import {
  deleteConversationById,
  getConversationDetail,
  listConversations,
} from '@/lib/server/services/assistant'

import { getCurrentUserId } from './shared'

export async function listConversationsAction() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      success: false,
      error: 'AUTH_REQUIRED: Masuk dengan Google untuk melihat percakapan.',
    }
  }
  const result = await listConversations(userId)
  if (!result.ok) return { success: false, error: result.error.message }
  return { success: true, data: result.data }
}

export async function getConversationAction(conversationId: string) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      success: false,
      error: 'AUTH_REQUIRED: Masuk dengan Google untuk melihat percakapan.',
    }
  }
  const result = await getConversationDetail(userId, conversationId)
  if (!result.ok) return { success: false, error: result.error.message }
  return { success: true, data: result.data }
}

export async function deleteConversationAction(conversationId: string) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      success: false,
      error: 'AUTH_REQUIRED: Masuk dengan Google untuk menghapus percakapan.',
    }
  }
  const result = await deleteConversationById(userId, conversationId)
  if (!result.ok) return { success: false, error: result.error.message }
  return { success: true }
}
