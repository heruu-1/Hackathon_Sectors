import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { conversationMessages, conversations } from '@/db/schema'
import type {
  ConversationDTO,
  ConversationMessageDTO,
  ProposedAction,
} from '@/lib/contracts/assistant'

export async function getUserConversations(userId: string): Promise<ConversationDTO[]> {
  if (!userId) return []
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    title: r.title,
    ticker: r.ticker,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }))
}

export async function getConversation(
  userId: string,
  conversationId: string,
): Promise<ConversationDTO | null> {
  if (!userId || !conversationId) return null
  const rows = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1)

  if (!rows.length) return null
  const conv = rows[0]
  const messages = await getConversationMessages(conversationId)

  return {
    id: conv.id,
    userId: conv.userId,
    title: conv.title,
    ticker: conv.ticker,
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString(),
    messages,
  }
}

export async function createConversation(
  userId: string,
  title: string,
  ticker?: string,
): Promise<ConversationDTO> {
  const id = crypto.randomUUID()
  const cleanTicker = ticker ? ticker.trim().toUpperCase().replace(/\.JK$/i, '') : null
  const now = new Date()

  const [inserted] = await db
    .insert(conversations)
    .values({
      id,
      userId,
      title: title.slice(0, 255),
      ticker: cleanTicker,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  return {
    id: inserted.id,
    userId: inserted.userId,
    title: inserted.title,
    ticker: inserted.ticker,
    createdAt: inserted.createdAt.toISOString(),
    updatedAt: inserted.updatedAt.toISOString(),
    messages: [],
  }
}

export async function deleteConversation(userId: string, conversationId: string): Promise<boolean> {
  if (!userId || !conversationId) return false
  const rows = await db
    .delete(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .returning()

  return rows.length > 0
}

export async function getConversationMessages(
  conversationId: string,
  limit = 50,
): Promise<ConversationMessageDTO[]> {
  const rows = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(conversationMessages.createdAt, conversationMessages.id)
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    conversationId: r.conversationId,
    role: r.role as 'user' | 'assistant',
    content: r.content,
    analysisSource: r.analysisSource as 'GEMINI' | 'RULE_BASED' | null,
    sources: r.sources as ConversationMessageDTO['sources'],
    proposedAction: r.proposedAction as ProposedAction | null,
    snapshotId: r.snapshotId,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function addConversationMessage(
  conversationId: string,
  data: {
    role: 'user' | 'assistant'
    content: string
    analysisSource?: 'GEMINI' | 'RULE_BASED' | null
    sources?: ConversationMessageDTO['sources']
    proposedAction?: ProposedAction | null
    snapshotId?: string | null
  },
): Promise<ConversationMessageDTO> {
  const id = crypto.randomUUID()
  const now = new Date()

  const [inserted] = await db
    .insert(conversationMessages)
    .values({
      id,
      conversationId,
      role: data.role,
      content: data.content,
      analysisSource: data.analysisSource ?? null,
      sources: data.sources ?? null,
      proposedAction: data.proposedAction ?? null,
      snapshotId: data.snapshotId ?? null,
      createdAt: now,
    })
    .returning()

  // Update conversation updatedAt
  await db.update(conversations).set({ updatedAt: now }).where(eq(conversations.id, conversationId))

  return {
    id: inserted.id,
    conversationId: inserted.conversationId,
    role: inserted.role as 'user' | 'assistant',
    content: inserted.content,
    analysisSource: inserted.analysisSource as 'GEMINI' | 'RULE_BASED' | null,
    sources: inserted.sources as ConversationMessageDTO['sources'],
    proposedAction: inserted.proposedAction as ProposedAction | null,
    snapshotId: inserted.snapshotId,
    createdAt: inserted.createdAt.toISOString(),
  }
}
