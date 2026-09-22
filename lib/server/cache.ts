import { and, eq, gt, lt } from 'drizzle-orm'

import { db } from '../../db/index.ts'
import { apiCache, cacheLeases } from '../../db/schema.ts'

// In-memory cache capped at 500 entries
interface MemoryEntry {
  data: unknown
  expiresAt: number
}

const memoryCache = new Map<string, MemoryEntry>()
const pendingRequests = new Map<string, Promise<unknown>>()
const MAX_MEMORY_ENTRIES = 500

function setMemory(key: string, data: unknown, expiresAt: number) {
  if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
    // Delete oldest 50 entries
    const keysToDelete = Array.from(memoryCache.keys()).slice(0, 50)
    for (const k of keysToDelete) memoryCache.delete(k)
  }
  memoryCache.set(key, { data, expiresAt })
}

let dbUnavailableUntil = 0

export function isDbTemporarilyUnavailable(): boolean {
  return Date.now() < dbUnavailableUntil
}

export function markDbUnavailable(): void {
  dbUnavailableUntil = Date.now() + 60_000 // 60s cooldown before retrying DB
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
  if (!process.env.DATABASE_URL || isDbTemporarilyUnavailable()) {
    return true
  }
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
  } catch (error) {
    const isConnErr =
      error instanceof Error &&
      (error.message.includes('ECONNREFUSED') || error.message.includes('connect'))
    if (isConnErr) {
      markDbUnavailable()
      return true
    }
    // Another instance holds active lease
    return false
  }
}

export async function releaseCacheLease(cacheKey: string, holderId: string): Promise<void> {
  if (!process.env.DATABASE_URL || isDbTemporarilyUnavailable()) {
    return
  }
  try {
    await db
      .delete(cacheLeases)
      .where(and(eq(cacheLeases.cacheKey, cacheKey), eq(cacheLeases.holder, holderId)))
  } catch (error) {
    const isConnErr =
      error instanceof Error &&
      (error.message.includes('ECONNREFUSED') || error.message.includes('connect'))
    if (isConnErr) {
      markDbUnavailable()
    }
  }
}

/**
 * Two-tier cache with lease protection.
 */
export async function getOrSetCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  options?: { forceRefresh?: boolean },
): Promise<T> {
  const pending = pendingRequests.get(key)
  if (pending) return pending as Promise<T>
  const request = readOrRefreshCache(key, ttlMs, fetcher, options?.forceRefresh === true)
  pendingRequests.set(key, request)
  try {
    return await request
  } finally {
    pendingRequests.delete(key)
  }
}

async function readOrRefreshCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  forceRefresh: boolean,
): Promise<T> {
  const now = Date.now()

  // 1. Check in-memory cache
  const inMem = memoryCache.get(key)
  // Manual refreshes share a short cooldown to bound public upstream requests.
  if (inMem && inMem.expiresAt > now && (!forceRefresh || inMem.expiresAt - ttlMs > now - 60_000)) {
    return inMem.data as T
  }

  // 2. Check persistent database cache
  if (process.env.DATABASE_URL && !isDbTemporarilyUnavailable()) {
    try {
      const rows = await db
        .select()
        .from(apiCache)
        .where(and(eq(apiCache.cacheKey, key), gt(apiCache.expiresAt, new Date(now))))
        .limit(1)

      if (rows.length > 0 && (!forceRefresh || rows[0].createdAt.getTime() > now - 60_000)) {
        const item = rows[0]
        setMemory(key, item.data, item.expiresAt.getTime())
        return item.data as T
      }
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes('ECONNREFUSED') || err.message.includes('connect'))
      ) {
        markDbUnavailable()
      }
    }
  }

  // 3. Acquire lease to prevent duplicate upstream calls across instances
  const holderId = crypto.randomUUID()
  const leaseTtlSeconds = Math.max(10, Math.min(60, Math.ceil(ttlMs / 1000)))
  const hasLease = await acquireCacheLease(key, holderId, leaseTtlSeconds)

  if (!hasLease) {
    // Another instance is currently fetching. Wait briefly for it to populate the cache.
    for (let attempt = 0; attempt < 5; attempt++) {
      if (typeof setTimeout !== 'undefined') {
        await new Promise((resolve) => setTimeout(resolve, 250))
      } else if (typeof globalThis !== 'undefined' && globalThis.setTimeout) {
        await new Promise((resolve) => globalThis.setTimeout(resolve, 250))
      }
      const mem = memoryCache.get(key)
      if (mem && mem.expiresAt > Date.now()) return mem.data as T

      if (process.env.DATABASE_URL && !isDbTemporarilyUnavailable()) {
        try {
          const rows = await db.select().from(apiCache).where(eq(apiCache.cacheKey, key)).limit(1)
          if (rows.length > 0 && rows[0].expiresAt.getTime() > Date.now()) {
            setMemory(key, rows[0].data, rows[0].expiresAt.getTime())
            return rows[0].data as T
          }
        } catch {
          // ignore DB error
        }
      }
    }
    // If still not populated, return stale in-memory data if available rather than thundering upstream
    if (inMem) {
      return inMem.data as T
    }
  }

  try {
    const fresh = await fetcher()
    const expiresAtDate = new Date(Date.now() + ttlMs)

    setMemory(key, fresh, expiresAtDate.getTime())

    if (process.env.DATABASE_URL && !isDbTemporarilyUnavailable()) {
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
      } catch (err) {
        if (
          err instanceof Error &&
          (err.message.includes('ECONNREFUSED') || err.message.includes('connect'))
        ) {
          markDbUnavailable()
        }
      }
    }

    return fresh
  } finally {
    if (hasLease) {
      await releaseCacheLease(key, holderId)
    }
  }
}
