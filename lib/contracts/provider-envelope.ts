/**
 * Canonical Provider Envelope for RASI Market & Signal Data.
 * Standardizes payload structure, honest provenance, and delay tracking.
 */

export type ProviderStatus = 'SUCCESS' | 'PARTIAL' | 'EMPTY' | 'ERROR' | 'UNAVAILABLE'

export type ProviderSource =
  'SECTORS' | 'sectors-daily' | 'YAHOO' | 'GEMINI' | 'RULE_BASED' | 'RASI'

export interface ProviderIssue {
  code: string
  message: string
}

export interface ProviderEnvelope<T> {
  status: ProviderStatus
  source: ProviderSource
  observedAt: string
  sourceDelayMinutes: number
  issues: ProviderIssue[]
  data: T | null
}

export function createProviderEnvelope<T>(params: {
  status: ProviderStatus
  source: ProviderSource
  data: T | null
  observedAt?: string
  sourceDelayMinutes?: number
  issues?: ProviderIssue[]
}): ProviderEnvelope<T> {
  return {
    status: params.status,
    source: params.source,
    observedAt: params.observedAt ?? new Date().toISOString(),
    sourceDelayMinutes: params.sourceDelayMinutes ?? 0,
    issues: params.issues ?? [],
    data: params.data,
  }
}
