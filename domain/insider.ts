import type { InsiderFilingDetail, InsiderIndicator } from '../lib/contracts/analysis.ts'
import type { InsiderFilingRow } from '../lib/contracts/market.ts'

function sanitizeUrl(url?: string): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString()
    }
    return undefined
  } catch {
    return undefined
  }
}

/**
 * Analyzes insider filings.
 * Note on percentage: share_percentage_transaction is ALREADY in percentage points (e.g. 2.56 means 2.56%).
 * Never multiply by 100 again.
 */
export function analyzeInsiderMovement(
  filings: InsiderFilingRow[] | null | undefined,
  currentMarketPrice: number | null = null,
): InsiderIndicator {
  if (!filings || filings.length === 0) {
    return {
      dataState: 'empty',
      hasInsiderActivity: false,
      status: 'NO_RECENT_FILINGS',
      insiderRiskScore: 20,
      latestFiling: null,
      filingsCount: 0,
      summary: 'Tidak ditemukan pelaporan transaksi orang dalam (insider filing) terbaru.',
    }
  }

  // Sort filings by timestamp/date descending to ensure true latest filing is evaluated
  const sortedFilings = [...filings].sort((a, b) => {
    const dateA = a.timestamp ?? ''
    const dateB = b.timestamp ?? ''
    return dateB.localeCompare(dateA)
  })

  const latest = sortedFilings[0]
  const actionStr = latest.transaction_type?.toLowerCase()
  const action: 'BUY' | 'SELL' | 'OTHER' =
    actionStr === 'buy' ? 'BUY' : actionStr === 'sell' ? 'SELL' : 'OTHER'

  const price = typeof latest.price === 'number' && latest.price > 0 ? latest.price : null
  const value = typeof latest.transaction_value === 'number' ? latest.transaction_value : 0
  // share_percentage_transaction is already percentage points (2.56 = 2.56%)
  const pct =
    typeof latest.share_percentage_transaction === 'number'
      ? latest.share_percentage_transaction
      : 0

  const holderName = latest.holder_name ?? 'Insider Terdaftar'
  const holderType = latest.holder_type ?? 'Orang Dalam'
  const dateStr = latest.timestamp ? latest.timestamp.split('T')[0] : 'Terkini'
  const sourceUrl = sanitizeUrl(latest.source)

  let status: InsiderIndicator['status'] = 'ROUTINE_TRANSACTION'
  let riskScore = 30
  const reasons: string[] = []

  // Check 1: Steep discount dump (only if market comparison price is valid and price is valid)
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
        `🚨 DISKON EKSTREM: ${holderName} melepas saham di harga Rp ${price.toLocaleString('id-ID')} (${discountPct.toFixed(1)}% di bawah harga pasar pembanding Rp ${currentMarketPrice.toLocaleString('id-ID')}).`,
      )
    }
  }

  // Check 2: Massive divestment
  if (status !== 'STEEP_DISCOUNT_DUMP' && action === 'SELL') {
    if (pct >= 1.0 || value >= 10_000_000_000) {
      status = 'MASSIVE_DIVESTMENT'
      riskScore = 75
      reasons.push(
        `⚠️ DIVESTASI BESAR: ${holderName} melepas ${pct.toFixed(2)}% kepemilikan senilai Rp ${(value / 1_000_000_000).toFixed(2)} Miliar.`,
      )
    } else {
      riskScore = 45
      reasons.push(
        `${holderName} menjual ${pct.toFixed(2)}% saham senilai Rp ${(value / 1_000_000_000).toFixed(2)} Miliar.`,
      )
    }
  }

  // Check 3: Aggressive buy
  if (action === 'BUY') {
    if (pct >= 0.5 || value >= 5_000_000_000) {
      status = 'AGGRESSIVE_BUY'
      riskScore = 15
      reasons.push(
        `💎 AKUMULASI INSIDER: ${holderName} menambah kepemilikan ${pct.toFixed(2)}% senilai Rp ${(value / 1_000_000_000).toFixed(2)} Miliar.`,
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

  const latestFilingDetail: InsiderFilingDetail = {
    holderName,
    holderType,
    action,
    amountShares: latest.amount_transaction ?? 0,
    transactionPrice: price,
    totalValueIdr: value,
    pctChanged: pct,
    date: dateStr,
    notes: latest.body ?? latest.title ?? 'Pelaporan perubahan kepemilikan saham.',
    sourceUrl,
  }

  return {
    dataState: 'ready',
    hasInsiderActivity: true,
    status,
    insiderRiskScore: riskScore,
    latestFiling: latestFilingDetail,
    filingsCount: sortedFilings.length,
    summary: reasons.join(' '),
  }
}
