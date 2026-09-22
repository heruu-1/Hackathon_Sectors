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
    const raw = await requestSectorsShared<Record<string, unknown>>(
      `https://api.sectors.app/v2/company/report/${cleanTicker}/?sections=segments`,
      {
        capabilityId: 'company_report',
        params: { sections: ['segments'] },
        apiKey,
        fetchFn,
      },
    )

    if (!raw || typeof raw !== 'object') {
      return createEmptyEnvelope('SECTORS', null, 'Data segmen bisnis tidak tersedia.')
    }

    const seg = (raw.segments as Record<string, unknown>) ?? {}
    const rawList = Array.isArray(seg.revenue)
      ? (seg.revenue as Array<Record<string, unknown>>)
      : Array.isArray(seg)
        ? (seg as Array<Record<string, unknown>>)
        : Array.isArray(raw.segments_revenue)
          ? (raw.segments_revenue as Array<Record<string, unknown>>)
          : []

    const revenueSegments: RawSegmentItem[] = rawList
      .map((item) => ({
        name: String(item.name ?? item.segment ?? item.title ?? 'Segmen'),
        value: typeof item.value === 'number' ? item.value : null,
        percentage:
          typeof item.percentage === 'number'
            ? item.percentage
            : typeof item.pct === 'number'
              ? item.pct
              : null,
      }))
      .filter((s: RawSegmentItem) => s.name)

    const data: CompanySegmentsData = {
      symbol: cleanTicker,
      companyName: typeof raw.company_name === 'string' ? raw.company_name : cleanTicker,
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
