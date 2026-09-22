/**
 * Service for broker activity exploration and dual-broker comparison (F04).
 */
import {
  type BrokerActivitySummary,
  type DualBrokerComparison,
  aggregateBrokerActivity,
  compareTwoBrokers,
} from '../../../domain/broker-activity.ts'
import type { BrokerRegistryEntry } from '../../contracts/market.ts'
import { getOrSetCache } from '../cache.ts'
import { fetchBrokerActivity } from '../providers/broker-activity.ts'
import { fetchBrokersRegistry } from '../providers/sectors.ts'

export async function getBrokersRegistryList(): Promise<Record<string, BrokerRegistryEntry>> {
  const env = await getOrSetCache('sectors:registry', 86_400_000 * 7, () => fetchBrokersRegistry())
  return env.data ?? {}
}

export async function getBrokerActivityService(
  brokerCode: string,
  startDate?: string,
  endDate?: string,
  options?: { forceRefresh?: boolean },
): Promise<BrokerActivitySummary | null> {
  const cleanCode = brokerCode.trim().toUpperCase()
  if (!cleanCode) return null

  const registry = await getBrokersRegistryList()

  const cacheKey = `sectors:broker-act:${cleanCode}:${startDate ?? 'default'}:${endDate ?? 'default'}`
  const env = await getOrSetCache(
    cacheKey,
    86_400_000,
    () => fetchBrokerActivity(cleanCode, startDate, endDate),
    options,
  )

  if (!env.data || env.data.length === 0) {
    return aggregateBrokerActivity(
      cleanCode,
      [],
      registry,
      env.periodStart || startDate || '',
      env.periodEnd || endDate || '',
    )
  }

  return aggregateBrokerActivity(
    cleanCode,
    env.data,
    registry,
    env.periodStart || startDate || '',
    env.periodEnd || endDate || '',
  )
}

export async function compareTwoBrokersService(
  codeA: string,
  codeB: string,
  startDate?: string,
  endDate?: string,
  options?: { forceRefresh?: boolean },
): Promise<DualBrokerComparison | null> {
  const [summaryA, summaryB] = await Promise.all([
    getBrokerActivityService(codeA, startDate, endDate, options),
    getBrokerActivityService(codeB, startDate, endDate, options),
  ])

  if (!summaryA || !summaryB) return null

  return compareTwoBrokers(summaryA, summaryB)
}
