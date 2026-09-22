import { and, eq } from 'drizzle-orm'

import { db } from '../../db/index.ts'
import { requestKeys } from '../../db/schema.ts'

/**
 * Retrieves a previously saved response payload for the given user, operation, and request key.
 */
export async function getIdempotentResponse<T>(
  userId: string,
  operation: string,
  requestKey: string,
): Promise<T | null> {
  if (!userId || !requestKey || !process.env.DATABASE_URL) return null

  try {
    const rows = await db
      .select({ payload: requestKeys.responsePayload })
      .from(requestKeys)
      .where(
        and(
          eq(requestKeys.userId, userId),
          eq(requestKeys.operation, operation),
          eq(requestKeys.requestKey, requestKey),
        ),
      )
      .limit(1)

    if (!rows.length || rows[0].payload === null || rows[0].payload === undefined) {
      return null
    }

    return rows[0].payload as T
  } catch {
    // If DB is unreachable or in-memory test environment, return null to proceed with execution
    return null
  }
}

/**
 * Saves a response payload for idempotency deduplication.
 */
export async function saveIdempotentResponse<T>(
  userId: string,
  operation: string,
  requestKey: string,
  payload: T,
): Promise<void> {
  if (!userId || !requestKey || !process.env.DATABASE_URL) return

  try {
    await db
      .insert(requestKeys)
      .values({
        userId,
        operation,
        requestKey,
        responsePayload: payload as unknown as Record<string, unknown>,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [requestKeys.userId, requestKeys.operation, requestKeys.requestKey],
        set: {
          responsePayload: payload as unknown as Record<string, unknown>,
        },
      })
  } catch {
    // Ignore persistence failures so they don't break the user response
  }
}

const inFlightRequests = new Map<string, Promise<unknown>>()

/**
 * Wraps an asynchronous operation with idempotency deduplication.
 * If a matching (userId, operation, requestKey) exists, returns the cached response.
 * Concurrent executions with the same key share the same in-flight Promise.
 */
export async function withIdempotency<T>(
  userId: string,
  operation: string,
  requestKey: string,
  execute: () => Promise<T>,
): Promise<T> {
  const compoundKey = `${userId}:${operation}:${requestKey}`
  const pending = inFlightRequests.get(compoundKey)
  if (pending) {
    return (await pending) as T
  }

  const task = (async () => {
    const existing = await getIdempotentResponse<T>(userId, operation, requestKey)
    if (existing !== null && existing !== undefined) {
      return existing
    }

    const result = await execute()
    await saveIdempotentResponse<T>(userId, operation, requestKey, result)
    return result
  })()

  inFlightRequests.set(compoundKey, task)
  try {
    return await task
  } finally {
    inFlightRequests.delete(compoundKey)
  }
}
