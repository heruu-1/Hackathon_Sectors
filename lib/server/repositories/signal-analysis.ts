import { and, desc, eq } from 'drizzle-orm'

import { db } from '../../../db/index.ts'
import {
  type SignalContextRow,
  signalAnalysisRuns,
  signalContexts,
} from '../../../db/schema.ts'
import type {
  SignalAnalysisReport,
  SignalContext,
} from '../../contracts/signal-analysis.ts'

function mapRowToSignalContext(row: SignalContextRow): SignalContext {
  return {
    id: row.id,
    ticker: row.ticker,
    signalAt: row.signalAt.toISOString(),
    referencePrice: row.referencePrice,
    referencePriceAt: row.referencePriceAt.toISOString(),
    ruleLabel: row.ruleLabel,
    provenance: row.provenance as SignalContext['provenance'],
    methodologyVersion: row.methodologyVersion,
    initialRiskParams: row.initialRiskParams as SignalContext['initialRiskParams'],
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Saves a signal context to PostgreSQL.
 * Throws on database failure so caller knows persistence did not succeed.
 */
export async function saveSignalContext(context: SignalContext): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_UNAVAILABLE: DATABASE_URL tidak dikonfigurasi.')
  }

  await db
    .insert(signalContexts)
    .values({
      id: context.id,
      ticker: context.ticker.trim().toUpperCase(),
      signalAt: new Date(context.signalAt),
      referencePrice: context.referencePrice,
      referencePriceAt: new Date(context.referencePriceAt),
      ruleLabel: context.ruleLabel,
      provenance: context.provenance,
      methodologyVersion: context.methodologyVersion,
      initialRiskParams: context.initialRiskParams,
      createdAt: new Date(context.createdAt),
    })
    .onConflictDoNothing({
      target: [signalContexts.id],
    })
}

/**
 * Retrieves the latest signal context for a ticker.
 */
export async function getLatestSignalContextForTicker(
  ticker: string,
): Promise<SignalContext | null> {
  if (!process.env.DATABASE_URL) return null

  const cleanTicker = ticker.trim().toUpperCase()
  const rows = await db
    .select()
    .from(signalContexts)
    .where(eq(signalContexts.ticker, cleanTicker))
    .orderBy(desc(signalContexts.signalAt))
    .limit(1)

  if (rows.length === 0) return null
  return mapRowToSignalContext(rows[0])
}

/**
 * Retrieves a signal context by its ID.
 */
export async function getSignalContextById(id: string): Promise<SignalContext | null> {
  if (!process.env.DATABASE_URL) return null

  const rows = await db
    .select()
    .from(signalContexts)
    .where(eq(signalContexts.id, id))
    .limit(1)

  if (rows.length === 0) return null
  return mapRowToSignalContext(rows[0])
}

/**
 * Lists signal contexts for a ticker in descending order of signalAt.
 */
export async function listSignalContextsForTicker(
  ticker: string,
  limit = 10,
): Promise<SignalContext[]> {
  if (!process.env.DATABASE_URL) return []

  const cleanTicker = ticker.trim().toUpperCase()
  const rows = await db
    .select()
    .from(signalContexts)
    .where(eq(signalContexts.ticker, cleanTicker))
    .orderBy(desc(signalContexts.signalAt))
    .limit(limit)

  return rows.map(mapRowToSignalContext)
}

/**
 * Saves a signal analysis run record.
 * Uses unique constraint on (contextId, asOf, methodologyVersion, configHash) to avoid duplicate runs.
 */
export async function saveSignalAnalysisRun(params: {
  contextId: string
  asOf: string
  methodologyVersion: string
  configHash: string
  dataChecksum: string
  report: SignalAnalysisReport
  status: 'completed' | 'partial' | 'error'
}): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_UNAVAILABLE: DATABASE_URL tidak dikonfigurasi.')
  }

  await db
    .insert(signalAnalysisRuns)
    .values({
      contextId: params.contextId,
      asOf: new Date(params.asOf),
      methodologyVersion: params.methodologyVersion,
      configHash: params.configHash,
      dataChecksum: params.dataChecksum,
      report: params.report as unknown as Record<string, unknown>,
      status: params.status,
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        signalAnalysisRuns.contextId,
        signalAnalysisRuns.asOf,
        signalAnalysisRuns.methodologyVersion,
        signalAnalysisRuns.configHash,
      ],
      set: {
        dataChecksum: params.dataChecksum,
        report: params.report as unknown as Record<string, unknown>,
        status: params.status,
      },
    })
}

/**
 * Retrieves the latest saved analysis run for a given context ID.
 */
export async function getLatestSignalAnalysisRunForContext(
  contextId: string,
): Promise<SignalAnalysisReport | null> {
  if (!process.env.DATABASE_URL) return null

  const rows = await db
    .select()
    .from(signalAnalysisRuns)
    .where(eq(signalAnalysisRuns.contextId, contextId))
    .orderBy(desc(signalAnalysisRuns.asOf), desc(signalAnalysisRuns.createdAt))
    .limit(1)

  if (rows.length === 0) return null
  return rows[0].report as unknown as SignalAnalysisReport
}

/**
 * Retrieves a specific analysis run by matching exact keys.
 */
export async function getExactSignalAnalysisRun(params: {
  contextId: string
  asOf: string
  methodologyVersion: string
  configHash: string
}): Promise<SignalAnalysisReport | null> {
  if (!process.env.DATABASE_URL) return null

  const asOfDate = new Date(params.asOf)
  const rows = await db
    .select()
    .from(signalAnalysisRuns)
    .where(
      and(
        eq(signalAnalysisRuns.contextId, params.contextId),
        eq(signalAnalysisRuns.asOf, asOfDate),
        eq(signalAnalysisRuns.methodologyVersion, params.methodologyVersion),
        eq(signalAnalysisRuns.configHash, params.configHash),
      ),
    )
    .limit(1)

  if (rows.length === 0) return null
  return rows[0].report as unknown as SignalAnalysisReport
}
