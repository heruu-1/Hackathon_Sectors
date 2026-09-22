import { normalizeTicker } from '../../../domain/ticker.ts'
import {
  type DataEnvelope,
  createEmptyEnvelope,
  createEnvelope,
  createErrorEnvelope,
} from '../../contracts/market.ts'
import { requestSectorsShared } from './transport.ts'

export interface RawQuarterlyFinancial {
  quarter: string // e.g. "2024-Q3"
  revenue?: number | null
  net_income?: number | null
  operating_profit?: number | null
  operating_cash_flow?: number | null
  total_assets?: number | null
  total_liabilities?: number | null
  total_equity?: number | null
  net_interest_income?: number | null // for banks
  loans?: number | null // for banks
  deposits?: number | null // for banks
  basis?: 'standalone' | 'YTD' | 'unknown'
}

/**
 * Fetches quarterly financials via shared transport with cost bounded to max 5 quarters (5 credits).
 */
export async function fetchQuarterlyFinancials(
  ticker: string,
  apiKey?: string,
  maxQuarters = 5,
  fetchFn: typeof fetch = fetch,
): Promise<DataEnvelope<RawQuarterlyFinancial[]>> {
  const cleanTicker = normalizeTicker(ticker)
  const quartersToRequest = Math.max(1, Math.min(maxQuarters, 8)) // Bound to max 8, default 5

  try {
    const raw = await requestSectorsShared<unknown>(
      `https://api.sectors.app/v2/financials/quarterly/${cleanTicker}/`,
      {
        capabilityId: 'financials_quarterly',
        params: { quarters: quartersToRequest },
        apiKey,
        fetchFn,
      },
    )

    if (!Array.isArray(raw)) {
      return createEmptyEnvelope('SECTORS', null, 'Data keuangan kuartalan kosong.')
    }

    const rows: RawQuarterlyFinancial[] = raw
      .slice(0, quartersToRequest)
      .map((item: Record<string, unknown>): RawQuarterlyFinancial => {
        const q = String(item.quarter ?? item.period ?? '')
        const basis: RawQuarterlyFinancial['basis'] =
          item.basis === 'standalone' || item.basis === 'YTD' ? item.basis : 'unknown'
        return {
          quarter: q,
          revenue: typeof item.revenue === 'number' ? item.revenue : null,
          net_income: typeof item.net_income === 'number' ? item.net_income : null,
          operating_profit:
            typeof item.operating_profit === 'number' ? item.operating_profit : null,
          operating_cash_flow:
            typeof item.operating_cash_flow === 'number' ? item.operating_cash_flow : null,
          total_assets: typeof item.total_assets === 'number' ? item.total_assets : null,
          total_liabilities:
            typeof item.total_liabilities === 'number' ? item.total_liabilities : null,
          total_equity: typeof item.total_equity === 'number' ? item.total_equity : null,
          net_interest_income:
            typeof item.net_interest_income === 'number' ? item.net_interest_income : null,
          loans: typeof item.loans === 'number' ? item.loans : null,
          deposits: typeof item.deposits === 'number' ? item.deposits : null,
          basis,
        }
      })
      .filter((r) => r.quarter)

    if (rows.length === 0) {
      return createEmptyEnvelope('SECTORS', null, 'Tidak ada data kuartal valid.')
    }

    return createEnvelope({
      state: rows.length >= 4 ? 'ready' : 'partial',
      data: rows,
      source: 'SECTORS',
      sourceDate: rows[0]?.quarter ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat data keuangan kuartalan.'
    return createErrorEnvelope('SECTORS', message)
  }
}
