import { sql } from 'drizzle-orm'

import { db } from '@/db'
import { getFeatureFlagStatus } from '@/lib/server/env'
import { logger } from '@/lib/server/logger'

export const dynamic = 'force-dynamic'

export async function GET() {
  const timestamp = new Date().toISOString()
  let databaseStatus: 'connected' | 'disconnected' = 'disconnected'
  let dbLatencyMs: number | null = null
  let dbError: string | null = null
  let migrationsStatus: 'applied' | 'pending' | 'unmigrated' | 'unknown' = 'unknown'
  let migrationsCount = 0

  try {
    const start = performance.now()
    // Perform a quick ping query to verify database connectivity
    await Promise.race([
      db.execute(sql`SELECT 1`),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database ping timeout after 3000ms')), 3000),
      ),
    ])
    dbLatencyMs = Math.round(performance.now() - start)
    databaseStatus = 'connected'

    // Check migration ledger status
    try {
      const migRows = (await db.execute(
        sql`SELECT count(*)::int as count FROM _rasi_migrations`,
      )) as unknown as Array<{ count: number }>
      migrationsCount = migRows[0]?.count ?? 0
      migrationsStatus = migrationsCount >= 4 ? 'applied' : 'pending'
    } catch {
      migrationsStatus = 'unmigrated'
    }
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error)
    logger.error('HealthCheck: Database check failed', error, { databaseStatus: 'disconnected' })
    databaseStatus = 'disconnected'
  }

  const isHealthy = databaseStatus === 'connected' && migrationsStatus !== 'unmigrated'

  const payload = {
    status: isHealthy ? 'ok' : 'degraded',
    readiness: isHealthy ? 'READY' : 'NOT_READY',
    timestamp,
    version: '0.1.0',
    database: {
      status: databaseStatus,
      latencyMs: dbLatencyMs,
      error: dbError || undefined,
    },
    migrations: {
      status: migrationsStatus,
      appliedCount: migrationsCount,
    },
    features: getFeatureFlagStatus(),
  }

  return Response.json(payload, {
    status: isHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
