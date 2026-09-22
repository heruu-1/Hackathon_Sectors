/**
 * Provider for Sectors API v2 company segments endpoint.
 * Fetches business/revenue segments for an IDX company.
 */
import { normalizeTicker } from '../../../domain/ticker.ts'
import {
  type DataEnvelope,
  createEmptyEnvelope,
  createEnvelope,
  createErrorEnvelope,
} from '../../contracts/market.ts'
import { requestSectorsShared } from './transport.ts'

export interface RawSegmentItem {
  name: string
  value?: number | null
  percentage?: number | null
}

export interface CompanySegmentsData {
  symbol: string
  companyName: string
  revenueSegments: RawSegmentItem[]
}

export async function fetchCompanySegments(
  ticker: string,
  apiKey?: string,
  fetchFn: typeof fetch = fetch,
): Promise<DataEnvelope<CompanySegmentsData>> {
  const cleanTicker = normalizeTicker(ticker)

  try {
    const raw = await requestSectorsShared<{
      symbol?: string
      financial_year?: number
      revenue_breakdown?: Array<{
        value?: number
        source?: string
        target?: string
      }>
      [key: string]: unknown
    }>(`https://api.sectors.app/v2/company/get-segments/${cleanTicker}/`, {
      capabilityId: 'company_segments',
      apiKey,
      fetchFn,
    })

    if (!raw || typeof raw !== 'object') {
      return createEmptyEnvelope('SECTORS', null, 'Data segmen bisnis tidak tersedia.')
    }

    const breakdown = Array.isArray(raw.revenue_breakdown) ? raw.revenue_breakdown : []
    const totalVal = breakdown.reduce(
      (sum, item) => sum + (typeof item.value === 'number' ? item.value : 0),
      0,
    )

    const revenueSegments: RawSegmentItem[] = breakdown
      .map((item) => {
        const val = typeof item.value === 'number' ? item.value : null
        const pct = totalVal > 0 && val !== null ? (val / totalVal) * 100 : null
        const name =
          item.source && item.target
            ? `${item.source} (${item.target})`
            : item.source || item.target || 'Segmen'
        return {
          name,
          value: val,
          percentage: pct !== null ? Number(pct.toFixed(2)) : null,
        }
      })
      .filter((s) => s.name)

    const data: CompanySegmentsData = {
      symbol: cleanTicker,
      companyName: cleanTicker,
      revenueSegments,
    }

    return createEnvelope({
      state: revenueSegments.length > 0 ? 'ready' : 'empty',
      data,
      source: 'SECTORS',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat segmen bisnis.'
    return createErrorEnvelope('SECTORS', message)
  }
}
