export interface BrokerRow {
  broker_code: string
  bfreq?: number
  blot?: number
  bval?: number
  bavg_per_share?: number
  sfreq?: number
  slot?: number
  sval?: number
  savg_per_share?: number
  nlot?: number
  nval?: number
  navg_per_share?: number
}

export interface BrokerInfo {
  code: string
  name: string
  is_foreign: boolean
  cohort: 'institutional' | 'retail' | 'mixed' | 'unknown'
}

export interface TopBrokerItem {
  code: string
  name?: string
  isForeign: boolean
  cohort: string
  lot: number
  value: number
  avgPrice: number
  netValue: number
}

export interface BandarmologyAnalysis {
  status:
    | 'BIG_ACCUMULATION'
    | 'NORMAL_ACCUMULATION'
    | 'NEUTRAL'
    | 'NORMAL_DISTRIBUTION'
    | 'BIG_DISTRIBUTION'
  bandarScore: number // 0 - 100
  cr3Buy: number // Percentage of buy value from top 3
  cr5Buy: number
  cr3Sell: number
  cr5Sell: number
  topBuyers: TopBrokerItem[]
  topSellers: TopBrokerItem[]
  foreignBuyVal: number
  foreignSellVal: number
  netForeignVal: number
  foreignFlowStatus: 'HEAVY_INFLOW' | 'INFLOW' | 'NEUTRAL' | 'OUTFLOW' | 'HEAVY_OUTFLOW'
  bandarAvgPrice: number | null
  currentPrice: number | null
  bandarMarginPct: number | null
  flowSummary: string
  date: string
}

export interface DailyPriceRow {
  symbol: string
  date: string
  close: number
  open?: number
  high?: number
  low?: number
  volume: number
  market_cap?: number
}

export interface VolumeSpikeResult {
  spikeRatio: number | null
  formattedRatio: string
  status: 'EXTREME' | 'HIGH' | 'NORMAL' | 'LOW' | 'UNKNOWN'
  todayVolume: number
  avgVolume: number
}

// Known common retail brokers on IDX
const RETAIL_BROKERS = new Set(['YP', 'XC', 'PD', 'KK', 'SQ', 'NI', 'XL', 'CP', 'BQ', 'OD', 'EP'])

export function analyzeBandarmology(
  brokerRows: BrokerRow[],
  brokerRegistry: Record<string, BrokerInfo> = {},
  currentClosePrice: number | null = null,
  dateString: string = 'Latest',
): BandarmologyAnalysis {
  if (!brokerRows || brokerRows.length === 0) {
    return {
      status: 'NEUTRAL',
      bandarScore: 50,
      cr3Buy: 0,
      cr5Buy: 0,
      cr3Sell: 0,
      cr5Sell: 0,
      topBuyers: [],
      topSellers: [],
      foreignBuyVal: 0,
      foreignSellVal: 0,
      netForeignVal: 0,
      foreignFlowStatus: 'NEUTRAL',
      bandarAvgPrice: null,
      currentPrice: currentClosePrice,
      bandarMarginPct: null,
      flowSummary: 'Data broker summary tidak tersedia untuk periode ini.',
      date: dateString,
    }
  }

  let totalBuyVal = 0
  let totalSellVal = 0
  let foreignBuyVal = 0
  let foreignSellVal = 0

  const items = brokerRows.map((row) => {
    const code = row.broker_code?.toUpperCase() ?? 'UNKNOWN'
    const bval = Number(row.bval) || 0
    const sval = Number(row.sval) || 0
    const blot = Number(row.blot) || 0
    const slot = Number(row.slot) || 0
    const nval = Number(row.nval) || bval - sval
    const bavg = Number(row.bavg_per_share) || (blot > 0 ? bval / (blot * 100) : 0)
    const savg = Number(row.savg_per_share) || (slot > 0 ? sval / (slot * 100) : 0)

    const meta = brokerRegistry[code]
    const isForeign = meta?.is_foreign ?? false
    const cohort = meta?.cohort ?? (RETAIL_BROKERS.has(code) ? 'retail' : 'unknown')

    totalBuyVal += bval
    totalSellVal += sval

    if (isForeign) {
      foreignBuyVal += bval
      foreignSellVal += sval
    }

    return {
      code,
      name: meta?.name ?? code,
      isForeign,
      cohort,
      bval,
      sval,
      blot,
      slot,
      nval,
      bavg,
      savg,
    }
  })

  // Sort by Buy Value
  const sortedBuyers = [...items].sort((a, b) => b.bval - a.bval)
  // Sort by Sell Value
  const sortedSellers = [...items].sort((a, b) => b.sval - a.sval)

  const top3BuyVal = sortedBuyers.slice(0, 3).reduce((acc, x) => acc + x.bval, 0)
  const top5BuyVal = sortedBuyers.slice(0, 5).reduce((acc, x) => acc + x.bval, 0)

  const top3SellVal = sortedSellers.slice(0, 3).reduce((acc, x) => acc + x.sval, 0)
  const top5SellVal = sortedSellers.slice(0, 5).reduce((acc, x) => acc + x.sval, 0)

  const cr3Buy = totalBuyVal > 0 ? (top3BuyVal / totalBuyVal) * 100 : 0
  const cr5Buy = totalBuyVal > 0 ? (top5BuyVal / totalBuyVal) * 100 : 0
  const cr3Sell = totalSellVal > 0 ? (top3SellVal / totalSellVal) * 100 : 0
  const cr5Sell = totalSellVal > 0 ? (top5SellVal / totalSellVal) * 100 : 0

  const topBuyers: TopBrokerItem[] = sortedBuyers.slice(0, 5).map((x) => ({
    code: x.code,
    name: x.name,
    isForeign: x.isForeign,
    cohort: x.cohort,
    lot: x.blot,
    value: x.bval,
    avgPrice: Math.round(x.bavg),
    netValue: x.nval,
  }))

  const topSellers: TopBrokerItem[] = sortedSellers.slice(0, 5).map((x) => ({
    code: x.code,
    name: x.name,
    isForeign: x.isForeign,
    cohort: x.cohort,
    lot: x.slot,
    value: x.sval,
    avgPrice: Math.round(x.savg),
    netValue: x.nval,
  }))

  // Bandar status determination
  const netForeignVal = foreignBuyVal - foreignSellVal
  const netBuyersSum = sortedBuyers.slice(0, 3).reduce((acc, x) => acc + x.nval, 0)
  const netSellersSum = sortedSellers.slice(0, 3).reduce((acc, x) => acc + x.nval, 0)

  let status: BandarmologyAnalysis['status'] = 'NEUTRAL'
  let bandarScore = 50

  const diffCR3 = cr3Buy - cr3Sell

  if (diffCR3 > 20 || (cr3Buy > 60 && netBuyersSum > 0)) {
    status = cr3Buy > 70 ? 'BIG_ACCUMULATION' : 'NORMAL_ACCUMULATION'
    bandarScore = cr3Buy > 70 ? 85 : 70
  } else if (diffCR3 < -20 || (cr3Sell > 60 && netSellersSum < 0)) {
    status = cr3Sell > 70 ? 'BIG_DISTRIBUTION' : 'NORMAL_DISTRIBUTION'
    bandarScore = cr3Sell > 70 ? 15 : 30
  } else {
    status = 'NEUTRAL'
    bandarScore = 50
  }

  // Adjust score based on Foreign Flow
  if (netForeignVal > 1_000_000_000) {
    bandarScore = Math.min(100, bandarScore + 10)
  } else if (netForeignVal < -1_000_000_000) {
    bandarScore = Math.max(0, bandarScore - 10)
  }

  // Foreign Flow status
  let foreignFlowStatus: BandarmologyAnalysis['foreignFlowStatus'] = 'NEUTRAL'
  if (netForeignVal > 5_000_000_000) foreignFlowStatus = 'HEAVY_INFLOW'
  else if (netForeignVal > 500_000_000) foreignFlowStatus = 'INFLOW'
  else if (netForeignVal < -5_000_000_000) foreignFlowStatus = 'HEAVY_OUTFLOW'
  else if (netForeignVal < -500_000_000) foreignFlowStatus = 'OUTFLOW'

  // Bandar average cost for top 3 buyers
  const top3BuyersLots = sortedBuyers.slice(0, 3).reduce((acc, x) => acc + x.blot, 0)
  const bandarAvgPrice = top3BuyersLots > 0 ? Math.round(top3BuyVal / (top3BuyersLots * 100)) : null

  let bandarMarginPct: number | null = null
  if (bandarAvgPrice && currentClosePrice && bandarAvgPrice > 0) {
    bandarMarginPct = Number(
      (((currentClosePrice - bandarAvgPrice) / bandarAvgPrice) * 100).toFixed(2),
    )
  }

  // Build natural Indonesian summary
  const summaryParts: string[] = []
  if (status === 'BIG_ACCUMULATION') {
    summaryParts.push(
      `Akumulasi masif terdeteksi (CR3 Pembeli ${cr3Buy.toFixed(1)}%). Top pembeli: ${topBuyers
        .slice(0, 3)
        .map((b) => b.code)
        .join(', ')}.`,
    )
  } else if (status === 'NORMAL_ACCUMULATION') {
    summaryParts.push(
      `Terindikasi akumulasi teratur (CR3 ${cr3Buy.toFixed(1)}%). Konsentrasi pembeli lebih kuat dibanding penjual.`,
    )
  } else if (status === 'BIG_DISTRIBUTION') {
    summaryParts.push(
      `Distribusi besar terdeteksi (CR3 Penjual ${cr3Sell.toFixed(1)}%). Penjual dominan melepas kepemilikan.`,
    )
  } else if (status === 'NORMAL_DISTRIBUTION') {
    summaryParts.push(
      `Terindikasi distribusi (CR3 Penjual ${cr3Sell.toFixed(1)}%). Tekanan jual lebih terkonsentrasi.`,
    )
  } else {
    summaryParts.push(
      `Arus transaksi relatif berimbang (CR3 Buy ${cr3Buy.toFixed(1)}% vs Sell ${cr3Sell.toFixed(1)}%).`,
    )
  }

  if (foreignFlowStatus === 'HEAVY_INFLOW' || foreignFlowStatus === 'INFLOW') {
    summaryParts.push(`Net Asing Masuk Rp ${(netForeignVal / 1_000_000_000).toFixed(2)} Miliar.`)
  } else if (foreignFlowStatus === 'HEAVY_OUTFLOW' || foreignFlowStatus === 'OUTFLOW') {
    summaryParts.push(
      `Net Asing Keluar Rp ${(Math.abs(netForeignVal) / 1_000_000_000).toFixed(2)} Miliar.`,
    )
  }

  if (bandarAvgPrice && currentClosePrice) {
    if (bandarMarginPct !== null && bandarMarginPct >= 0) {
      summaryParts.push(
        `Harga pasar (+${bandarMarginPct}%) berada di atas rata-rata harga beli broker terpilih (Rp ${bandarAvgPrice.toLocaleString('id-ID')}).`,
      )
    } else if (bandarMarginPct !== null) {
      summaryParts.push(
        `Harga pasar (${bandarMarginPct}%) berada di bawah rata-rata harga beli broker terpilih (Rp ${bandarAvgPrice.toLocaleString('id-ID')}).`,
      )
    }
  }

  return {
    status,
    bandarScore,
    cr3Buy: Number(cr3Buy.toFixed(1)),
    cr5Buy: Number(cr5Buy.toFixed(1)),
    cr3Sell: Number(cr3Sell.toFixed(1)),
    cr5Sell: Number(cr5Sell.toFixed(1)),
    topBuyers,
    topSellers,
    foreignBuyVal,
    foreignSellVal,
    netForeignVal,
    foreignFlowStatus,
    bandarAvgPrice,
    currentPrice: currentClosePrice,
    bandarMarginPct,
    flowSummary: summaryParts.join(' '),
    date: dateString,
  }
}

export function calculateVolumeSpike(dailyRows: DailyPriceRow[]): VolumeSpikeResult {
  if (!dailyRows || dailyRows.length === 0) {
    return {
      spikeRatio: null,
      formattedRatio: 'N/A',
      status: 'UNKNOWN',
      todayVolume: 0,
      avgVolume: 0,
    }
  }

  // Sort chronological
  const sorted = [...dailyRows].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted[sorted.length - 1]
  const todayVolume = latest.volume

  if (sorted.length === 1) {
    return {
      spikeRatio: 1.0,
      formattedRatio: '1.0x (1h)',
      status: 'NORMAL',
      todayVolume,
      avgVolume: todayVolume,
    }
  }

  // Calculate SMA volume of prior days (up to 20 days)
  const prior = sorted.slice(0, sorted.length - 1)
  const sample = prior.slice(-20)
  const sumVolume = sample.reduce((acc, row) => acc + row.volume, 0)
  const avgVolume = sumVolume / sample.length

  if (avgVolume <= 0) {
    return {
      spikeRatio: 1.0,
      formattedRatio: '1.0x',
      status: 'NORMAL',
      todayVolume,
      avgVolume: 0,
    }
  }

  const ratio = Number((todayVolume / avgVolume).toFixed(2))
  let status: VolumeSpikeResult['status'] = 'NORMAL'
  if (ratio >= 2.5) status = 'EXTREME'
  else if (ratio >= 1.5) status = 'HIGH'
  else if (ratio < 0.6) status = 'LOW'

  return {
    spikeRatio: ratio,
    formattedRatio: `${ratio}x`,
    status,
    todayVolume,
    avgVolume: Math.round(avgVolume),
  }
}
