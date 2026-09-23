import { and, desc, eq } from 'drizzle-orm'

import { db } from '../../../db/index.ts'
import { conversationMessages, conversations } from '../../../db/schema.ts'
import type {
  ConversationDTO,
  ConversationMessageDTO,
  ProposedAction,
} from '../../contracts/assistant.ts'

const inMemoryConversations = new Map<string, ConversationDTO>()
const inMemoryMessages = new Map<string, ConversationMessageDTO[]>()

export async function getUserConversations(userId: string): Promise<ConversationDTO[]> {
  if (!userId) return []
  try {
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
  } catch {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_UNAVAILABLE: Gagal mengakses data percakapan di database.')
    }
    return Array.from(inMemoryConversations.values()).filter((c) => c.userId === userId)
  }
}

export async function getConversation(
  userId: string,
  conversationId: string,
): Promise<ConversationDTO | null> {
  if (!userId || !conversationId) return null
  try {
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
  } catch {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_UNAVAILABLE: Gagal mengakses data percakapan di database.')
    }
    const conv = inMemoryConversations.get(conversationId)
    if (!conv || conv.userId !== userId) return null
    return conv
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

  try {
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
  } catch {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_UNAVAILABLE: Gagal menyimpan percakapan baru ke database.')
    }
    const conv: ConversationDTO = {
      id,
      userId,
      title: title.slice(0, 255),
      ticker: cleanTicker,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      messages: [],
    }
    inMemoryConversations.set(id, conv)
    return conv
  }
}

export async function deleteConversation(userId: string, conversationId: string): Promise<boolean> {
  if (!userId || !conversationId) return false
  try {
    const rows = await db
      .delete(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .returning()

    return rows.length > 0
  } catch {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_UNAVAILABLE: Gagal menghapus percakapan dari database.')
    }
    const existing = inMemoryConversations.get(conversationId)
    if (!existing || existing.userId !== userId) return false
    inMemoryConversations.delete(conversationId)
    inMemoryMessages.delete(conversationId)
    return true
  }
}

export async function getConversationMessages(
  conversationId: string,
  limit = 50,
): Promise<ConversationMessageDTO[]> {
  try {
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
  } catch {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_UNAVAILABLE: Gagal memuat pesan percakapan dari database.')
    }
    return (inMemoryMessages.get(conversationId) ?? []).slice(-limit)
  }
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

  try {
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
    await db
      .update(conversations)
      .set({ updatedAt: now })
      .where(eq(conversations.id, conversationId))

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
  } catch {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_UNAVAILABLE: Gagal menyimpan pesan percakapan ke database.')
    }
    const msg: ConversationMessageDTO = {
      id,
      conversationId,
      role: data.role,
      content: data.content,
      analysisSource: data.analysisSource ?? null,
      sources: data.sources ?? undefined,
      proposedAction: data.proposedAction ?? null,
      snapshotId: data.snapshotId ?? undefined,
      createdAt: now.toISOString(),
    }
    const list = inMemoryMessages.get(conversationId) ?? []
    list.push(msg)
    inMemoryMessages.set(conversationId, list)
    return msg
  }
}
