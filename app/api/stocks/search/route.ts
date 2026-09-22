import { NextResponse } from 'next/server'

import { getStockRelevanceScore, searchLocalStocks } from '@/domain/stocks'

function escapeLike(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "''")
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (!query) {
    return NextResponse.json({ results: searchLocalStocks('', 8) })
  }

  const localMatches = searchLocalStocks(query, 8)

  const key = process.env.SECTORS_API_KEY?.trim()
  if (!key || key === 'your_sectors_api_key_here') {
    // If API key is missing, return local popular stock matches gracefully
    return NextResponse.json({ results: localMatches })
  }

  const safe = escapeLike(query.slice(0, 80))
  const whereClause =
    query.length === 1
      ? `symbol like '${safe}%'`
      : `symbol like '${safe}%' or symbol like '%${safe}%' or company_name like '%${safe}%'`

  const params = new URLSearchParams({
    where: whereClause,
    order_by: 'symbol',
    limit: '20',
    offset: '0',
  })

  try {
    const { requestSectorsShared } = await import('@/lib/server/providers/transport')
    const payload = await requestSectorsShared<{
      results?: Array<{
        symbol?: string
        company_name?: string
        sector?: string
        sub_sector?: string
      }>
    }>('https://api.sectors.app/v2/companies/?' + params.toString(), {
      capabilityId: 'companies_screener',
      apiKey: key,
      timeoutMs: 8_000,
    })

    const remoteItems = (payload.results ?? []).map((item) => ({
      symbol: item.symbol?.replace(/\.JK$/i, '') ?? '',
      name: item.company_name ?? 'Nama belum tersedia',
      sector: item.sector ?? item.sub_sector ?? 'Sektor belum tersedia',
    }))

    // Combine local and remote items with deduplication
    const seen = new Set<string>()
    const combined: Array<{ symbol: string; name: string; sector: string }> = []

    for (const item of [...localMatches, ...remoteItems]) {
      if (!item.symbol) continue
      const upper = item.symbol.toUpperCase()
      if (seen.has(upper)) continue
      seen.add(upper)
      combined.push(item)
    }

    // Sort by relevance score (e.g., query "TL" ranks TLKM & TLDN above ARII & ATLA)
    combined.sort((a, b) => {
      const scoreA = getStockRelevanceScore(query, a)
      const scoreB = getStockRelevanceScore(query, b)
      if (scoreB !== scoreA) return scoreB - scoreA
      return a.symbol.localeCompare(b.symbol)
    })

    return NextResponse.json({ results: combined.slice(0, 8) })
  } catch {
    // Return local matches if remote API fails
    return NextResponse.json({ results: localMatches })
  }
}
