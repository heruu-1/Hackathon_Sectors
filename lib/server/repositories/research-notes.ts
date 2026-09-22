/**
 * Repository for research_notes table in PostgreSQL (F12).
 * Stores personal user thesis, invalidation triggers, and watch metrics.
 */
import { and, desc, eq } from 'drizzle-orm'

import { db } from '../../../db/index.ts'
import { type ResearchNoteRow, researchNotes } from '../../../db/schema.ts'

export async function createOrUpdateResearchNote(
  userId: string,
  ticker: string,
  snapshotId: string,
  thesis: string,
  invalidationTriggers?: string,
  watchMetrics?: Record<string, unknown>,
): Promise<ResearchNoteRow> {
  const cleanTicker = ticker.trim().toUpperCase()
  const id = crypto.randomUUID()

  const [row] = await db
    .insert(researchNotes)
    .values({
      id,
      userId,
      ticker: cleanTicker,
      snapshotId,
      thesis,
      invalidationTriggers: invalidationTriggers ?? null,
      watchMetrics: watchMetrics ?? null,
    })
    .onConflictDoUpdate({
      target: [researchNotes.userId, researchNotes.snapshotId],
      set: {
        thesis,
        invalidationTriggers: invalidationTriggers ?? null,
        watchMetrics: watchMetrics ?? null,
        updatedAt: new Date(),
      },
    })
    .returning()

  return row
}

export async function getResearchNotesByTicker(
  userId: string,
  ticker: string,
): Promise<ResearchNoteRow[]> {
  const cleanTicker = ticker.trim().toUpperCase()
  return db
    .select()
    .from(researchNotes)
    .where(and(eq(researchNotes.userId, userId), eq(researchNotes.ticker, cleanTicker)))
    .orderBy(desc(researchNotes.createdAt))
}

export async function getUserResearchNotes(userId: string): Promise<ResearchNoteRow[]> {
  return db
    .select()
    .from(researchNotes)
    .where(eq(researchNotes.userId, userId))
    .orderBy(desc(researchNotes.createdAt))
}
