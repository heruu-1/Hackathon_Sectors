import { eq, like, lt } from 'drizzle-orm'

import { db } from '@/db'
import { analysisHistory, cacheLeases, quotaBuckets, user, watchlist } from '@/db/schema'

import { type Result, errorResult, successResult } from '../../contracts/result.ts'

/**
 * Cleans up personal analysis history entries older than the retention period (default: 90 days).
 * Public analysis snapshots are preserved for cache and audit purposes.
 */
export async function cleanupOldHistory(retentionDays = 90): Promise<number> {
  if (!process.env.DATABASE_URL) return 0

  const cutoff = new Date(Date.now() - retentionDays * 86_400_000)
  try {
    const deleted = await db
      .delete(analysisHistory)
      .where(lt(analysisHistory.createdAt, cutoff))
      .returning({ id: analysisHistory.id })

    return deleted.length
  } catch {
    return 0
  }
}

/**
 * Cleans up expired cache leases so stale locks don't block new requests.
 */
export async function cleanupExpiredLeases(): Promise<number> {
  if (!process.env.DATABASE_URL) return 0

  const now = new Date()
  try {
    const deleted = await db
      .delete(cacheLeases)
      .where(lt(cacheLeases.expiresAt, now))
      .returning({ key: cacheLeases.cacheKey })

    return deleted.length
  } catch {
    return 0
  }
}

/**
 * Cleans up quota bucket entries older than retention period (default: 7 days).
 */
export async function cleanupOldQuotaBuckets(retentionDays = 7): Promise<number> {
  if (!process.env.DATABASE_URL) return 0

  const cutoff = new Date(Date.now() - retentionDays * 86_400_000)
  try {
    const deleted = await db
      .delete(quotaBuckets)
      .where(lt(quotaBuckets.updatedAt, cutoff))
      .returning({ id: quotaBuckets.id })

    return deleted.length
  } catch {
    return 0
  }
}

/**
 * Permanently deletes a user account and all personal data (watchlist, history, conversations, quota).
 */
export async function deleteUserAccount(userId: string): Promise<Result<{ success: boolean }>> {
  if (!userId) {
    return errorResult('AUTH_REQUIRED', 'ID pengguna tidak valid.')
  }

  if (!process.env.DATABASE_URL) {
    return errorResult('DATABASE_UNAVAILABLE', 'Database tidak tersedia.')
  }

  try {
    // 1. Clean up quota buckets for this user
    await db.delete(quotaBuckets).where(like(quotaBuckets.subject, `${userId}:%`))

    // 2. Explicitly remove watchlist items (in case FK cascade was deferred)
    await db.delete(watchlist).where(eq(watchlist.userId, userId))

    // 3. Delete user row (cascades to session, account, history, conversations, requestKeys)
    const deleted = await db.delete(user).where(eq(user.id, userId)).returning({ id: user.id })

    if (deleted.length === 0) {
      return errorResult('NOT_FOUND', 'Pengguna tidak ditemukan.')
    }

    return successResult({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menghapus akun pengguna.'
    return errorResult('DATABASE_UNAVAILABLE', message)
  }
}
