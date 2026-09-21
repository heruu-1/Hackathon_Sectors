import type { BandarmologyIndicator, TopBrokerItem } from '../lib/contracts/analysis.ts'
import type { BrokerRegistryEntry, BrokerRow } from '../lib/contracts/market.ts'

const RETAIL_BROKERS = new Set(['YP', 'XC', 'PD', 'KK', 'SQ', 'NI', 'XL', 'CP', 'BQ', 'OD', 'EP'])

/**
 * Pure Bandarmology & Broker Concentration Analysis.
 *
 * CRITICAL FIXES (F07):
 * 1. is_foreign is metadata of broker origin (e.g. UBS, JP Morgan).
 * 2. f_bval & f_sval represent actual transactions made by foreign investors.
 * 3. Foreign flow MUST be calculated from foreign investor transactions (f_bval/f_sval),
 *    NOT from the broker's is_foreign flag.
 * 4. nval = 0 is a valid number and must NOT be replaced with fallback calculation.
 */
export function analyzeBandarmology(
  brokerRows: BrokerRow[] | null | undefined,
  brokerRegistry: Record<string, BrokerRegistryEntry> = {},
  currentClosePrice: number | null = null,
  dateString: string | null = null,
): BandarmologyIndicator {
  if (!brokerRows || brokerRows.length === 0) {
    return {
      dataState: 'empty',
      status: 'INSUFFICIENT_DATA',
      bandarScore: null,
      cr3Buy: null,
      cr5Buy: null,
      cr3Sell: null,
      cr5Sell: null,
      topBuyers: [],
      topSellers: [],
      foreignBuyVal: null,
      foreignSellVal: null,
      netForeignVal: null,
      foreignFlowStatus: 'UNKNOWN',
      bandarAvgPrice: null,
      currentPrice: currentClosePrice,
      flowSummary: 'Data konsentrasi broker tidak tersedia untuk periode ini.',
      date: dateString,
    }
  }

  let totalBuyVal = 0
  let totalSellVal = 0
  let totalForeignBuyVal = 0
  let totalForeignSellVal = 0
  let hasForeignData = false

  const items = brokerRows.map((row) => {
    const code = row.broker_code?.toUpperCase() ?? 'UNKNOWN'
    const bval = Number.isFinite(row.bval) ? row.bval! : 0
    const sval = Number.isFinite(row.sval) ? row.sval! : 0
    const blot = Number.isFinite(row.blot) ? row.blot! : 0
    const slot = Number.isFinite(row.slot) ? row.slot! : 0

    // Preserve nval = 0 as valid value!
    const nval = Number.isFinite(row.nval) ? row.nval! : bval - sval

    const bavg =
      Number.isFinite(row.bavg_per_share) && row.bavg_per_share! > 0
        ? row.bavg_per_share!
        : blot > 0
          ? bval / (blot * 100)
          : 0

    const savg =
      Number.isFinite(row.savg_per_share) && row.savg_per_share! > 0
        ? row.savg_per_share!
        : slot > 0
          ? sval / (slot * 100)
          : 0

    const meta = brokerRegistry[code]
    const isForeignBroker = meta?.is_foreign ?? false
    const cohort = meta?.cohort ?? (RETAIL_BROKERS.has(code) ? 'retail' : 'unknown')

    totalBuyVal += bval
    totalSellVal += sval

    // Track foreign investor transactions (f_bval / f_sval)
    if (Number.isFinite(row.f_bval)) {
      totalForeignBuyVal += row.f_bval!
      hasForeignData = true
    }
    if (Number.isFinite(row.f_sval)) {
      totalForeignSellVal += row.f_sval!
      hasForeignData = true
    }

    return {
      code,
      name: meta?.name ?? code,
      isForeign: isForeignBroker,
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

  if (totalBuyVal === 0 && totalSellVal === 0) {
    return {
      dataState: 'empty',
      status: 'INSUFFICIENT_DATA',
      bandarScore: null,
      cr3Buy: null,
      cr5Buy: null,
      cr3Sell: null,
      cr5Sell: null,
      topBuyers: [],
      topSellers: [],
      foreignBuyVal: null,
      foreignSellVal: null,
      netForeignVal: null,
      foreignFlowStatus: 'UNKNOWN',
      bandarAvgPrice: null,
      currentPrice: currentClosePrice,
      flowSummary: 'Nilai transaksi broker tercatat nol.',
      date: dateString,
    }
  }

  // Sort by Buy Value descending
  const sortedBuyers = [...items].sort((a, b) => b.bval - a.bval)
  // Sort by Sell Value descending
  const sortedSellers = [...items].sort((a, b) => b.sval - a.sval)

  const top3BuyVal = sortedBuyers.slice(0, 3).reduce((acc, x) => acc + x.bval, 0)
  const top5BuyVal = sortedBuyers.slice(0, 5).reduce((acc, x) => acc + x.bval, 0)
  const top3SellVal = sortedSellers.slice(0, 3).reduce((acc, x) => acc + x.sval, 0)
  const top5SellVal = sortedSellers.slice(0, 5).reduce((acc, x) => acc + x.sval, 0)

  const cr3Buy = totalBuyVal > 0 ? Number(((top3BuyVal / totalBuyVal) * 100).toFixed(2)) : 0
  const cr5Buy = totalBuyVal > 0 ? Number(((top5BuyVal / totalBuyVal) * 100).toFixed(2)) : 0
  const cr3Sell = totalSellVal > 0 ? Number(((top3SellVal / totalSellVal) * 100).toFixed(2)) : 0
  const cr5Sell = totalSellVal > 0 ? Number(((top5SellVal / totalSellVal) * 100).toFixed(2)) : 0

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

  const netBuyersSum = sortedBuyers.slice(0, 3).reduce((acc, x) => acc + x.nval, 0)
  const netSellersSum = sortedSellers.slice(0, 3).reduce((acc, x) => acc + x.nval, 0)

  let status: BandarmologyIndicator['status'] = 'NEUTRAL'
  let bandarScore = 50

  const diffCR3 = cr3Buy - cr3Sell

  if (diffCR3 > 20 || (cr3Buy > 60 && netBuyersSum > 0)) {
    status = cr3Buy > 70 ? 'BIG_ACCUMULATION' : 'NORMAL_ACCUMULATION'
    bandarScore = Math.min(100, Math.round(50 + diffCR3 * 0.8 + (cr3Buy - 50) * 0.5))
  } else if (diffCR3 < -20 || (cr3Sell > 60 && netSellersSum < 0)) {
    status = cr3Sell > 70 ? 'BIG_DISTRIBUTION' : 'NORMAL_DISTRIBUTION'
    bandarScore = Math.max(0, Math.round(50 + diffCR3 * 0.8 - (cr3Sell - 50) * 0.5))
  }

  // Bandar average price from top 3 net buyers
  const top3PositiveBuyers = sortedBuyers.filter((x) => x.nval > 0).slice(0, 3)
  const bandarLotSum = top3PositiveBuyers.reduce((acc, x) => acc + x.blot, 0)
  const bandarValSum = top3PositiveBuyers.reduce((acc, x) => acc + x.bval, 0)
  const bandarAvgPrice = bandarLotSum > 0 ? Math.round(bandarValSum / (bandarLotSum * 100)) : null

  // Foreign flow assessment
  let foreignFlowStatus: BandarmologyIndicator['foreignFlowStatus'] = 'UNKNOWN'
  let netForeignVal: number | null = null

  if (hasForeignData) {
    netForeignVal = totalForeignBuyVal - totalForeignSellVal
    if (netForeignVal > 10_000_000_000) foreignFlowStatus = 'HEAVY_INFLOW'
    else if (netForeignVal > 2_000_000_000) foreignFlowStatus = 'INFLOW'
    else if (netForeignVal < -10_000_000_000) foreignFlowStatus = 'HEAVY_OUTFLOW'
    else if (netForeignVal < -2_000_000_000) foreignFlowStatus = 'OUTFLOW'
    else foreignFlowStatus = 'NEUTRAL'
  }

  const summaryParts: string[] = []
  if (status === 'BIG_ACCUMULATION') {
    summaryParts.push(
      `Akumulasi masif terdeteksi. 3 broker pembeli teratas menguasai ${cr3Buy}% transaksi beli.`,
    )
  } else if (status === 'NORMAL_ACCUMULATION') {
    summaryParts.push(`Terindikasi akumulasi moderat (CR3 Beli ${cr3Buy}% vs Jual ${cr3Sell}%).`)
  } else if (status === 'BIG_DISTRIBUTION') {
    summaryParts.push(
      `Distribusi besar terdeteksi. 3 broker penjual teratas melepas ${cr3Sell}% transaksi jual.`,
    )
  } else if (status === 'NORMAL_DISTRIBUTION') {
    summaryParts.push(`Terindikasi distribusi teratur (CR3 Jual ${cr3Sell}% vs Beli ${cr3Buy}%).`)
  } else {
    summaryParts.push(
      `Arus transaksi broker relatif berimbang (CR3 Beli ${cr3Buy}%, Jual ${cr3Sell}%).`,
    )
  }

  if (hasForeignData && netForeignVal !== null) {
    const netMiliar = (netForeignVal / 1_000_000_000).toFixed(2)
    summaryParts.push(
      `Arus investor asing: ${netForeignVal >= 0 ? '+' : ''}${netMiliar} Miliar (${foreignFlowStatus}).`,
    )
  }

  return {
    dataState: 'ready',
    status,
    bandarScore,
    cr3Buy,
    cr5Buy,
    cr3Sell,
    cr5Sell,
    topBuyers,
    topSellers,
    foreignBuyVal: hasForeignData ? totalForeignBuyVal : null,
    foreignSellVal: hasForeignData ? totalForeignSellVal : null,
    netForeignVal,
    foreignFlowStatus,
    bandarAvgPrice,
    currentPrice: currentClosePrice,
    flowSummary: summaryParts.join(' '),
    date: dateString,
  }
}
