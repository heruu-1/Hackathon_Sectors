/**
 * Repository for saved_screens table in PostgreSQL.
 */
import { and, desc, eq } from 'drizzle-orm'

import { db } from '../../../db/index.ts'
import { type SavedScreenRow, savedScreens } from '../../../db/schema.ts'

export async function createSavedScreen(
  userId: string,
  title: string,
  filters: Record<string, unknown>,
  presetId?: string,
): Promise<SavedScreenRow> {
  const [inserted] = await db
    .insert(savedScreens)
    .values({
      userId,
      title,
      presetId: presetId ?? null,
      filters,
    })
    .returning()

  return inserted
}

export async function getSavedScreensByUserId(userId: string): Promise<SavedScreenRow[]> {
  return db
    .select()
    .from(savedScreens)
    .where(eq(savedScreens.userId, userId))
    .orderBy(desc(savedScreens.createdAt))
}

export async function deleteSavedScreen(id: number, userId: string): Promise<boolean> {
  const result = await db
    .delete(savedScreens)
    .where(and(eq(savedScreens.id, id), eq(savedScreens.userId, userId)))
    .returning({ id: savedScreens.id })

  return result.length > 0
}
