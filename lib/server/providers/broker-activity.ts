/**
 * Provider for Sectors API v2 broker-activity endpoint.
 * Fetches transactions of a specific broker across stocks in IDX,
 * strictly bounded to a maximum of 14 calendar days.
 */
import {
  type DataEnvelope,
  createEmptyEnvelope,
  createEnvelope,
  createErrorEnvelope,
} from '../../contracts/market.ts'
import { requestSectorsShared } from './transport.ts'

export interface RawBrokerActivityItem {
  symbol: string
  bval?: number | null
  sval?: number | null
  blot?: number | null
  slot?: number | null
  net_val?: number | null
  total_val?: number | null
  date?: string | null
}

export async function fetchBrokerActivity(
  brokerCode: string,
  startDate?: string,
  endDate?: string,
  apiKey?: string,
  fetchFn: typeof fetch = fetch,
): Promise<DataEnvelope<RawBrokerActivityItem[]>> {
  const cleanCode = brokerCode.trim().toUpperCase()
  if (!cleanCode) {
    return createEmptyEnvelope('SECTORS', null, 'Kode broker tidak valid.')
  }

  // Calculate 14-day calendar bounding
  const end = endDate ? new Date(endDate) : new Date()
  const defaultStart = new Date(end.getTime() - 13 * 86_400_000) // 14 calendar days inclusive
  const requestedStart = startDate ? new Date(startDate) : defaultStart

  // Enforce max 14 days limit
  const earliestAllowedStart = new Date(end.getTime() - 13 * 86_400_000)
  const effectiveStart =
    requestedStart < earliestAllowedStart ? earliestAllowedStart : requestedStart

  const startStr = effectiveStart.toISOString().split('T')[0]
  const endStr = end.toISOString().split('T')[0]

  try {
    const raw = await requestSectorsShared<unknown>(
      `https://api.sectors.app/v2/broker-activity/${cleanCode}/?start=${startStr}&end=${endStr}`,
      {
        capabilityId: 'broker_activity',
        params: { broker_code: cleanCode, start: startStr, end: endStr },
        apiKey,
        fetchFn,
      },
    )

    // Sectors API v2 returns:
    // { broker_code: 'YP', start: '...', end: '...', data: [ { date: '...', summary: [ { symbol, bval, sval, nval, ... } ] } ] }
    let rawItems: Array<Record<string, unknown>> = []

    if (Array.isArray(raw)) {
      rawItems = raw as Array<Record<string, unknown>>
    } else if (raw && typeof raw === 'object') {
      const obj = raw as {
        data?: Array<
          | { date?: string; summary?: Array<Record<string, unknown>> }
          | Record<string, unknown>
        >
      }
      if (Array.isArray(obj.data)) {
        for (const entry of obj.data) {
          if (entry && typeof entry === 'object') {
            if ('summary' in entry && Array.isArray(entry.summary)) {
              const entryDate =
                'date' in entry && typeof entry.date === 'string' ? entry.date : null
              for (const item of entry.summary) {
                if (item && typeof item === 'object') {
                  rawItems.push({ ...item, date: item.date ?? entryDate })
                }
              }
            } else {
              rawItems.push(entry as Record<string, unknown>)
            }
          }
        }
      }
    }

    if (rawItems.length === 0) {
      const emptyEnv = createEmptyEnvelope<RawBrokerActivityItem[]>(
        'SECTORS',
        endStr,
        'Tidak ada aktivitas transaksi broker pada periode ini.',
      )
      emptyEnv.periodStart = startStr
      emptyEnv.periodEnd = endStr
      return emptyEnv
    }

    const rows: RawBrokerActivityItem[] = rawItems
      .map((item: Record<string, unknown>) => {
        const symbol = String(item.symbol ?? item.ticker ?? '')
          .replace(/\.JK$/i, '')
          .toUpperCase()
        const bval =
          typeof item.bval === 'number'
            ? item.bval
            : typeof item.buy_value === 'number'
              ? item.buy_value
              : 0
        const sval =
          typeof item.sval === 'number'
            ? item.sval
            : typeof item.sell_value === 'number'
              ? item.sell_value
              : 0
        const blot =
          typeof item.blot === 'number'
            ? item.blot
            : typeof item.buy_volume === 'number'
              ? item.buy_volume
              : 0
        const slot =
          typeof item.slot === 'number'
            ? item.slot
            : typeof item.sell_volume === 'number'
              ? item.sell_volume
              : 0
        const net_val =
          typeof item.nval === 'number'
            ? item.nval
            : typeof item.net_val === 'number'
              ? item.net_val
              : bval - sval
        const total_val =
          typeof item.total_val === 'number'
            ? item.total_val
            : bval + sval

        return {
          symbol,
          bval,
          sval,
          blot,
          slot,
          net_val,
          total_val,
          date: typeof item.date === 'string' ? item.date : null,
        }
      })
      .filter((r) => r.symbol)

    if (rows.length === 0) {
      const emptyEnv = createEmptyEnvelope<RawBrokerActivityItem[]>(
        'SECTORS',
        endStr,
        'Data aktivitas broker kosong.',
      )
      emptyEnv.periodStart = startStr
      emptyEnv.periodEnd = endStr
      return emptyEnv
    }

    return createEnvelope({
      state: 'ready',
      data: rows,
      source: 'SECTORS',
      periodStart: startStr,
      periodEnd: endStr,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat aktivitas broker.'
    return createErrorEnvelope('SECTORS', message)
  }
}
