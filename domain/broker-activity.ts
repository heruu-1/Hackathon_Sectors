/**
 * Domain module for broker activity aggregation, ranking, and dual-broker comparison (F04).
 */
import type { BrokerRegistryEntry } from '../lib/contracts/market.ts'
import type { RawBrokerActivityItem } from '../lib/server/providers/broker-activity.ts'
import { normalizeTicker } from './ticker.ts'

export interface StockBrokerActivity {
  symbol: string
  buyValue: number
  sellValue: number
  netValue: number
  grossValue: number
  grossSharePct: number // % of broker's total observed gross
  buyLot: number
  sellLot: number
  netLot: number
}

export interface BrokerActivitySummary {
  brokerCode: string
  brokerName: string
  isForeign: boolean
  cohort?: string
  periodStart: string
  periodEnd: string
  totalBuyValue: number
  totalSellValue: number
  totalNetValue: number
  totalGrossValue: number
  topNetBuy: StockBrokerActivity[]
  topNetSell: StockBrokerActivity[]
  topGross: StockBrokerActivity[]
}

export interface DualBrokerComparison {
  periodStart: string
  periodEnd: string
  brokerA: BrokerActivitySummary
  brokerB: BrokerActivitySummary
  commonStocks: Array<{
    symbol: string
    brokerANet: number
    brokerBNet: number
    alignment: 'AGREE_ACCUMULATION' | 'AGREE_DISTRIBUTION' | 'OPPOSING'
    summary: string
  }>
  overallSummary: string
}

/**
 * Aggregates raw broker activity items across stocks and computes rankings & market shares.
 */
export function aggregateBrokerActivity(
  brokerCode: string,
  rawItems: RawBrokerActivityItem[],
  registry: Record<string, BrokerRegistryEntry> = {},
  periodStart = '',
  periodEnd = '',
): BrokerActivitySummary {
  const code = brokerCode.trim().toUpperCase()
  const meta = registry[code]
  const brokerName = meta?.name ?? `Broker ${code}`
  const isForeign = Boolean(meta?.is_foreign)
  const cohort = meta?.cohort

  // Group by symbol (in case raw items have multiple dates)
  const stockMap = new Map<string, { bval: number; sval: number; blot: number; slot: number }>()

  let totalBuy = 0
  let totalSell = 0

  for (const item of rawItems) {
    const sym = normalizeTicker(item.symbol)
    const bval = item.bval ?? 0
    const sval = item.sval ?? 0
    const blot = item.blot ?? 0
    const slot = item.slot ?? 0

    totalBuy += bval
    totalSell += sval

    const existing = stockMap.get(sym) ?? { bval: 0, sval: 0, blot: 0, slot: 0 }
    existing.bval += bval
    existing.sval += sval
    existing.blot += blot
    existing.slot += slot
    stockMap.set(sym, existing)
  }

  const totalGross = totalBuy + totalSell
  const totalNet = totalBuy - totalSell

  const stocks: StockBrokerActivity[] = []
  for (const [symbol, stats] of stockMap.entries()) {
    const gross = stats.bval + stats.sval
    const net = stats.bval - stats.sval
    const grossShare = totalGross > 0 ? Number(((gross / totalGross) * 100).toFixed(2)) : 0

    stocks.push({
      symbol,
      buyValue: stats.bval,
      sellValue: stats.sval,
      netValue: net,
      grossValue: gross,
      grossSharePct: grossShare,
      buyLot: stats.blot,
      sellLot: stats.slot,
      netLot: stats.blot - stats.slot,
    })
  }

  // Sortings
  const topNetBuy = [...stocks]
    .filter((s) => s.netValue > 0)
    .sort((a, b) => b.netValue - a.netValue)
    .slice(0, 10)

  const topNetSell = [...stocks]
    .filter((s) => s.netValue < 0)
    .sort((a, b) => a.netValue - b.netValue) // largest negative first
    .slice(0, 10)

  const topGross = [...stocks].sort((a, b) => b.grossValue - a.grossValue).slice(0, 10)

  return {
    brokerCode: code,
    brokerName,
    isForeign,
    cohort,
    periodStart,
    periodEnd,
    totalBuyValue: totalBuy,
    totalSellValue: totalSell,
    totalNetValue: totalNet,
    totalGrossValue: totalGross,
    topNetBuy,
    topNetSell,
    topGross,
  }
}

/**
 * Compares two brokers during the same observation period.
 */
export function compareTwoBrokers(
  brokerA: BrokerActivitySummary,
  brokerB: BrokerActivitySummary,
): DualBrokerComparison {
  const allSymbols = new Set<string>()
  const mapA = new Map<string, StockBrokerActivity>()
  const mapB = new Map<string, StockBrokerActivity>()

  for (const s of [...brokerA.topGross, ...brokerA.topNetBuy, ...brokerA.topNetSell]) {
    allSymbols.add(s.symbol)
    mapA.set(s.symbol, s)
  }

  for (const s of [...brokerB.topGross, ...brokerB.topNetBuy, ...brokerB.topNetSell]) {
    allSymbols.add(s.symbol)
    mapB.set(s.symbol, s)
  }

  const commonStocks: DualBrokerComparison['commonStocks'] = []

  for (const sym of allSymbols) {
    const actA = mapA.get(sym)
    const actB = mapB.get(sym)

    if (actA && actB) {
      const netA = actA.netValue
      const netB = actB.netValue

      let alignment: 'AGREE_ACCUMULATION' | 'AGREE_DISTRIBUTION' | 'OPPOSING' = 'OPPOSING'
      let summary = ''

      if (netA > 0 && netB > 0) {
        alignment = 'AGREE_ACCUMULATION'
        summary = `Kedua broker kompak akumulasi (Net Buy A: Rp ${(netA / 1e9).toFixed(1)}M, B: Rp ${(netB / 1e9).toFixed(1)}M).`
      } else if (netA < 0 && netB < 0) {
        alignment = 'AGREE_DISTRIBUTION'
        summary = `Kedua broker kompak distribusi (Net Sell A: Rp ${(Math.abs(netA) / 1e9).toFixed(1)}M, B: Rp ${(Math.abs(netB) / 1e9).toFixed(1)}M).`
      } else {
        alignment = 'OPPOSING'
        summary = `Arah berlawanan: ${netA > 0 ? brokerA.brokerCode : brokerB.brokerCode} Net Buy, sedangkan ${netA < 0 ? brokerA.brokerCode : brokerB.brokerCode} Net Sell.`
      }

      commonStocks.push({
        symbol: sym,
        brokerANet: netA,
        brokerBNet: netB,
        alignment,
        summary,
      })
    }
  }

  // Generate overall summary
  const agreeBuyCount = commonStocks.filter((c) => c.alignment === 'AGREE_ACCUMULATION').length
  const agreeSellCount = commonStocks.filter((c) => c.alignment === 'AGREE_DISTRIBUTION').length
  const opposingCount = commonStocks.filter((c) => c.alignment === 'OPPOSING').length

  const overallSummary = `Perbandingan ${brokerA.brokerCode} vs ${brokerB.brokerCode}: Ditemukan ${commonStocks.length} saham yang sama-sama aktif. ${agreeBuyCount} saham kompak akumulasi, ${agreeSellCount} saham kompak distribusi, dan ${opposingCount} saham saling berlawanan arah.`

  return {
    periodStart: brokerA.periodStart || brokerB.periodStart,
    periodEnd: brokerA.periodEnd || brokerB.periodEnd,
    brokerA,
    brokerB,
    commonStocks,
    overallSummary,
  }
}
