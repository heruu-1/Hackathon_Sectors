export interface InsiderFilingRow {
  title?: string
  body?: string
  source?: string
  timestamp?: string
  sector?: string
  sub_sector?: string
  tags?: string[]
  symbol?: string
  transaction_type?: 'buy' | 'sell' | string
  holder_type?: string
  holder_name?: string
  holding_before?: number
  holding_after?: number
  amount_transaction?: number
  price?: number
  transaction_value?: number
  share_percentage_before?: number
  share_percentage_after?: number
  share_percentage_transaction?: number
  idx_investor_slug?: string
  idx_conglomerates_group_slug?: string
}

export interface InsiderMovementAnalysis {
  hasInsiderActivity: boolean
  status:
    | 'STEEP_DISCOUNT_DUMP'
    | 'AGGRESSIVE_BUY'
    | 'MASSIVE_DIVESTMENT'
    | 'CONGLOMERATE_SHUFFLE'
    | 'ROUTINE_TRANSACTION'
    | 'NO_RECENT_FILINGS'
  insiderRiskScore: number // 0 (very safe) to 100 (extreme insider warning)
  latestFiling: {
    holderName: string
    holderType: string
    action: 'BUY' | 'SELL' | 'OTHER'
    amountShares: number
    transactionPrice: number | null
    totalValueIdr: number
    pctChanged: number
    date: string
    notes: string
    sourceUrl?: string
  } | null
  filingsCount: number
  summary: string
}

export function analyzeInsiderMovement(
  filings: InsiderFilingRow[],
  currentMarketPrice: number | null = null,
): InsiderMovementAnalysis {
  if (!filings || filings.length === 0) {
    return {
      hasInsiderActivity: false,
      status: 'NO_RECENT_FILINGS',
      insiderRiskScore: 20,
      latestFiling: null,
      filingsCount: 0,
      summary: 'Tidak ditemukan pelaporan transaksi orang dalam (insider filing) terbaru.',
    }
  }

  const latest = filings[0]
  const action: 'BUY' | 'SELL' | 'OTHER' =
    latest.transaction_type?.toLowerCase() === 'buy'
      ? 'BUY'
      : latest.transaction_type?.toLowerCase() === 'sell'
        ? 'SELL'
        : 'OTHER'

  const price = typeof latest.price === 'number' && latest.price > 0 ? latest.price : null
  const value = typeof latest.transaction_value === 'number' ? latest.transaction_value : 0
  const pct =
    typeof latest.share_percentage_transaction === 'number'
      ? latest.share_percentage_transaction
      : 0
  const holderName = latest.holder_name ?? 'Insider Terdaftar'
  const holderType = latest.holder_type ?? 'Orang Dalam'
  const dateStr = latest.timestamp ? latest.timestamp.split('T')[0] : 'Terkini'

  let status: InsiderMovementAnalysis['status'] = 'ROUTINE_TRANSACTION'
  let riskScore = 30
  const reasons: string[] = []

  // Check 1: Steep discount dump
  if (
    action === 'SELL' &&
    price !== null &&
    currentMarketPrice !== null &&
    currentMarketPrice > 0
  ) {
    const discountPct = ((currentMarketPrice - price) / currentMarketPrice) * 100
    if (discountPct >= 25) {
      status = 'STEEP_DISCOUNT_DUMP'
      riskScore = 90
      reasons.push(
        `🚨 DISKON EKSTREM: ${holderName} melepas saham di harga Rp ${price.toLocaleString('id-ID')} (${discountPct.toFixed(1)}% di bawah harga pasar Rp ${currentMarketPrice.toLocaleString('id-ID')}).`,
      )
    }
  }

  // Check 2: Massive divestment
  if (status !== 'STEEP_DISCOUNT_DUMP' && action === 'SELL') {
    if (pct >= 1.0 || value >= 10_000_000_000) {
      status = 'MASSIVE_DIVESTMENT'
      riskScore = 75
      reasons.push(
        `Penjualan jumlah besar: ${holderName} melepas ${(pct * 100).toFixed(2)}% kepemilikan senilai Rp ${(value / 1_000_000_000).toFixed(2)} Miliar.`,
      )
    } else {
      riskScore = 45
      reasons.push(
        `${holderName} menjual ${(pct * 100).toFixed(2)}% saham senilai Rp ${(value / 1_000_000_000).toFixed(2)} Miliar.`,
      )
    }
  }

  // Check 3: Aggressive buy
  if (action === 'BUY') {
    if (pct >= 0.5 || value >= 5_000_000_000) {
      status = 'AGGRESSIVE_BUY'
      riskScore = 15 // Very bullish smart money signal!
      reasons.push(
        `Pembelian jumlah besar: ${holderName} menambah kepemilikan ${(pct * 100).toFixed(2)}% senilai Rp ${(value / 1_000_000_000).toFixed(2)} Miliar.`,
      )
    } else {
      riskScore = 25
      reasons.push(
        `${holderName} membeli saham senilai Rp ${(value / 1_000_000_000).toFixed(2)} Miliar.`,
      )
    }
  }

  // Check 4: Conglomerate group internal shuffle
  if (latest.idx_conglomerates_group_slug) {
    reasons.push(`Afiliasi grup: ${latest.idx_conglomerates_group_slug}.`)
  }

  return {
    hasInsiderActivity: true,
    status,
    insiderRiskScore: riskScore,
    latestFiling: {
      holderName,
      holderType,
      action,
      amountShares: latest.amount_transaction ?? 0,
      transactionPrice: price,
      totalValueIdr: value,
      pctChanged: pct,
      date: dateStr,
      notes: latest.body ?? latest.title ?? 'Pelaporan perubahan kepemilikan saham.',
      sourceUrl: latest.source,
    },
    filingsCount: filings.length,
    summary: reasons.join(' '),
  }
}
