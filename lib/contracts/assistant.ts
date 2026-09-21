import { z } from 'zod'

import { TickerSchema } from './watchlist.ts'

export const AssistantRequestSchema = z
  .object({
    conversationId: z.string().uuid().optional(),
    message: z
      .string()
      .trim()
      .min(1, 'Pesan tidak boleh kosong.')
      .max(2000, 'Pesan maksimal 2.000 karakter.'),
    ticker: TickerSchema.optional(),
    snapshotId: z.string().uuid().optional(),
    requestKey: z.string().uuid('Request key harus berupa UUID valid.'),
  })
  .strict()

export type AssistantRequest = z.infer<typeof AssistantRequestSchema>

export const ProposedActionSchema = z
  .object({
    type: z.literal('ADD_WATCHLIST'),
    ticker: TickerSchema,
    label: z.string().max(100),
  })
  .strict()

export type ProposedAction = z.infer<typeof ProposedActionSchema>

export interface AssistantSourceRef {
  label: string
  date?: string
  url?: string
}

export interface AssistantResponseDTO {
  conversationId: string
  messageId: string
  answer: string
  sources: AssistantSourceRef[]
  proposedAction: ProposedAction | null
  analysisSource: 'GEMINI' | 'RULE_BASED'
  model?: string
  warnings?: string[]
}

export interface ConversationMessageDTO {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  analysisSource?: 'GEMINI' | 'RULE_BASED' | null
  sources?: AssistantSourceRef[] | null
  proposedAction?: ProposedAction | null
  snapshotId?: string | null
  createdAt: string
}

export interface ConversationDTO {
  id: string
  userId: string
  title: string
  ticker: string | null
  createdAt: string
  updatedAt: string
  messages?: ConversationMessageDTO[]
}
