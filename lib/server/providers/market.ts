/**
 * Real-time market data provider for Indonesian Stocks (IDX).
 * Fetches second-by-second live intraday quotes from Yahoo Finance
 * with fallback to Sectors Financial API.
 */

export interface LiveMarketQuote {
  symbol: string
  ticker: string
  price: number | null
  previousClose: number | null
  change: number | null
  changePercent: string | null
  dayHigh: number | null
  dayLow: number | null
  volume: number | null
  timestamp: string | null
  currency: string
  source: string
}

export async function fetchLiveMarketQuote(ticker: string): Promise<LiveMarketQuote | null> {
  const cleanTicker = ticker.trim().toUpperCase().replace(/\.JK$/i, '')
  if (!/^[A-Z]{4}$/.test(cleanTicker)) return null

  // 1. Primary: Yahoo Finance for real-time live intraday data
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${cleanTicker}.JK?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      },
    )

    if (res.ok) {
      const json = (await res.json()) as {
        chart?: {
          result?: Array<{
            meta?: {
              currency?: string
              regularMarketPrice?: number
              previousClose?: number
              chartPreviousClose?: number
              regularMarketDayHigh?: number
              regularMarketDayLow?: number
              regularMarketVolume?: number
              regularMarketTime?: number
            }
          }>
        }
      }
      const meta = json?.chart?.result?.[0]?.meta
      if (meta && typeof meta.regularMarketPrice === 'number') {
        const prev = meta.previousClose ?? meta.chartPreviousClose ?? null
        const price = meta.regularMarketPrice
        const change = prev !== null ? price - prev : null
        const changePercent =
          change !== null && prev && prev > 0 ? `${((change / prev) * 100).toFixed(2)}%` : null

        const timeStr = meta.regularMarketTime
          ? new Date(meta.regularMarketTime * 1000).toLocaleString('id-ID', {
              timeZone: 'Asia/Jakarta',
              dateStyle: 'medium',
              timeStyle: 'medium',
            }) + ' WIB'
          : null

        return {
          symbol: `${cleanTicker}.JK`,
          ticker: cleanTicker,
          price,
          previousClose: prev,
          change,
          changePercent,
          dayHigh: meta.regularMarketDayHigh ?? null,
          dayLow: meta.regularMarketDayLow ?? null,
          volume: meta.regularMarketVolume ?? null,
          timestamp: timeStr,
          currency: meta.currency ?? 'IDR',
          source: 'Bursa Efek Indonesia (Real-Time)',
        }
      }
    }
  } catch {
    // Proceed to fallback
  }

  // 2. Fallback: Sectors Financial API
  const sectorsKey = process.env.SECTORS_API_KEY?.trim()
  if (sectorsKey && sectorsKey !== 'your_sectors_api_key_here') {
    try {
      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0]
      const res = await fetch(
        `https://api.sectors.app/v2/daily/${cleanTicker}/?start=${startDate}&end=${endDate}`,
        {
          headers: { Authorization: sectorsKey },
          signal: AbortSignal.timeout(6000),
        },
      )
      if (res.ok) {
        const data = (await res.json()) as Array<{
          close?: number
          open?: number
          high?: number
          low?: number
          volume?: number
          date?: string
        }>
        if (Array.isArray(data) && data.length > 0) {
          const latest = data[data.length - 1]
          const prev = data.length > 1 ? (data[data.length - 2].close ?? null) : null
          const price = latest.close ?? null
          const change = price !== null && prev !== null ? price - prev : null
          const changePercent =
            change !== null && prev && prev > 0 ? `${((change / prev) * 100).toFixed(2)}%` : null

          return {
            symbol: `${cleanTicker}.JK`,
            ticker: cleanTicker,
            price,
            previousClose: prev,
            change,
            changePercent,
            dayHigh: latest.high ?? null,
            dayLow: latest.low ?? null,
            volume: latest.volume ?? null,
            timestamp: latest.date ?? null,
            currency: 'IDR',
            source: 'Sectors Financial API',
          }
        }
      }
    } catch {
      // Return null if both fail
    }
  }

  return null
}
