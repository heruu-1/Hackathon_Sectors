import { NextResponse } from 'next/server'

import { sql } from 'drizzle-orm'

import { db } from '@/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const timestamp = new Date().toISOString()
  let databaseStatus: 'connected' | 'disconnected' = 'disconnected'
  let dbLatencyMs: number | null = null

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
  } catch (error) {
    console.error(
      '[HealthCheck] Database check failed:',
      error instanceof Error ? error.message : error,
    )
    databaseStatus = 'disconnected'
  }

  const isHealthy = databaseStatus === 'connected'

  return NextResponse.json(
    {
      status: isHealthy ? 'ok' : 'degraded',
      timestamp,
      version: '0.1.0',
      database: {
        status: databaseStatus,
        latencyMs: dbLatencyMs,
      },
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    },
  )
}
