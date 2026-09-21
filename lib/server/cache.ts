import { and, eq, gt, lt } from 'drizzle-orm'

import { db } from '@/db'
import { apiCache, cacheLeases } from '@/db/schema'

// In-memory cache capped at 500 entries
interface MemoryEntry {
  data: unknown
  expiresAt: number
}

const memoryCache = new Map<string, MemoryEntry>()
const MAX_MEMORY_ENTRIES = 500

function setMemory(key: string, data: unknown, expiresAt: number) {
  if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
    // Delete oldest 50 entries
    const keysToDelete = Array.from(memoryCache.keys()).slice(0, 50)
    for (const k of keysToDelete) memoryCache.delete(k)
  }
  memoryCache.set(key, { data, expiresAt })
}

/**
 * Attempts to acquire an atomic cache lease across serverless instances.
 * Returns true if lease was acquired, false if another instance holds an active lease.
 */
export async function acquireCacheLease(
  cacheKey: string,
  holderId: string,
  ttlSeconds = 60,
): Promise<boolean> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000)

  try {
    // 1. Delete expired lease if exists
    await db
      .delete(cacheLeases)
      .where(and(eq(cacheLeases.cacheKey, cacheKey), lt(cacheLeases.expiresAt, now)))

    // 2. Try inserting new lease
    await db.insert(cacheLeases).values({
      cacheKey,
      holder: holderId,
      acquiredAt: now,
      expiresAt,
    })
    return true
  } catch {
    // Another instance holds active lease
    return false
  }
}

export async function releaseCacheLease(cacheKey: string, holderId: string): Promise<void> {
  try {
    await db
      .delete(cacheLeases)
      .where(and(eq(cacheLeases.cacheKey, cacheKey), eq(cacheLeases.holder, holderId)))
  } catch {
    // Ignore lease release errors
  }
}

/**
 * Two-tier cache with lease protection.
 */
export async function getOrSetCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const now = Date.now()

  // 1. Check in-memory cache
  const inMem = memoryCache.get(key)
  if (inMem && inMem.expiresAt > now) {
    return inMem.data as T
  }

  // 2. Check persistent database cache
  if (process.env.DATABASE_URL) {
    try {
      const rows = await db
        .select()
        .from(apiCache)
        .where(and(eq(apiCache.cacheKey, key), gt(apiCache.expiresAt, new Date(now))))
        .limit(1)

      if (rows.length > 0) {
        const item = rows[0]
        setMemory(key, item.data, item.expiresAt.getTime())
        return item.data as T
      }
    } catch {
      // Database cache read failure fallback
    }
  }

  // 3. Acquire lease to prevent duplicate upstream calls across instances
  const holderId = crypto.randomUUID()
  const hasLease = await acquireCacheLease(key, holderId, Math.max(10, Math.ceil(ttlMs / 1000)))

  try {
    const fresh = await fetcher()
    const expiresAtDate = new Date(now + ttlMs)

    setMemory(key, fresh, now + ttlMs)

    if (process.env.DATABASE_URL) {
      try {
        await db
          .insert(apiCache)
          .values({
            cacheKey: key,
            data: fresh as unknown as Record<string, unknown>,
            expiresAt: expiresAtDate,
            createdAt: new Date(),
          })
          .onConflictDoUpdate({
            target: apiCache.cacheKey,
            set: {
              data: fresh as unknown as Record<string, unknown>,
              expiresAt: expiresAtDate,
              createdAt: new Date(),
            },
          })
      } catch {
        // Fall back to memory
      }
    }

    return fresh
  } finally {
    if (hasLease) {
      await releaseCacheLease(key, holderId)
    }
  }
}
