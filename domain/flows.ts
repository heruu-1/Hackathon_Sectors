/**
 * Domain module for foreign flows and broker summary aggregations.
 */

export interface ForeignFlowSession {
  date: string
  netForeign: number // Rupiah value
}

export interface ForeignFlowAggregation {
  netForeign1Session: number | null
  netForeign5Sessions: number | null
  netForeign20Sessions: number | null
  buySessionsCount: number
  sellSessionsCount: number
  totalValidSessions: number
  persistenceFraction: number | null // buySessions / totalValidSessions
}

export interface BrokerParticipant {
  brokerCode: string
  brokerName?: string
  isForeignBroker: boolean
  buyVolume: number // shares
  buyValue: number // IDR
  sellVolume: number // shares
  sellValue: number // IDR
  netVolume: number
  netValue: number
  grossValue: number
  avgBuyPrice: number | null
  avgSellPrice: number | null
}

export interface BrokerConcentration {
  top3BuyConcentration: number // fraction 0 - 1
  top5BuyConcentration: number
  top3SellConcentration: number
  top5SellConcentration: number
}

export interface BrokerSummaryAnalysis {
  topBuyers: BrokerParticipant[]
  topSellers: BrokerParticipant[]
  topGross: BrokerParticipant[]
  concentration: BrokerConcentration
  totalGrossValue: number
  totalBuyValue: number
  totalSellValue: number
}

export function aggregateForeignFlow(sessions: ForeignFlowSession[]): ForeignFlowAggregation {
  if (!sessions || sessions.length === 0) {
    return {
      netForeign1Session: null,
      netForeign5Sessions: null,
      netForeign20Sessions: null,
      buySessionsCount: 0,
      sellSessionsCount: 0,
      totalValidSessions: 0,
      persistenceFraction: null,
    }
  }

  // Sort ascending by date
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
  const n = sorted.length

  const sumWindow = (windowSize: number): number | null => {
    if (n < windowSize) return null
    return sorted.slice(n - windowSize).reduce((acc, curr) => acc + curr.netForeign, 0)
  }

  let buySessions = 0
  let sellSessions = 0
  for (const s of sorted) {
    if (s.netForeign > 0) buySessions++
    else if (s.netForeign < 0) sellSessions++
  }

  const totalValid = sorted.length
  const persistenceFraction = totalValid > 0 ? Number((buySessions / totalValid).toFixed(4)) : null

  return {
    netForeign1Session: sumWindow(1),
    netForeign5Sessions: sumWindow(5),
    netForeign20Sessions: sumWindow(20),
    buySessionsCount: buySessions,
    sellSessionsCount: sellSessions,
    totalValidSessions: totalValid,
    persistenceFraction,
  }
}

export interface RawBrokerItem {
  broker_code?: string
  broker_name?: string
  is_foreign?: boolean
  buy_volume?: number
  buy_value?: number
  sell_volume?: number
  sell_value?: number
  net_volume?: number
  net_value?: number
}

export function analyzeBrokers(raw: RawBrokerItem[]): BrokerSummaryAnalysis {
  if (!Array.isArray(raw) || raw.length === 0) {
    return {
      topBuyers: [],
      topSellers: [],
      topGross: [],
      concentration: {
        top3BuyConcentration: 0,
        top5BuyConcentration: 0,
        top3SellConcentration: 0,
        top5SellConcentration: 0,
      },
      totalGrossValue: 0,
      totalBuyValue: 0,
      totalSellValue: 0,
    }
  }

  const participants: BrokerParticipant[] = []
  let totalBuyValue = 0
  let totalSellValue = 0

  for (const item of raw) {
    if (!item.broker_code) continue
    const buyVol = Number(item.buy_volume ?? 0)
    const buyVal = Number(item.buy_value ?? 0)
    const sellVol = Number(item.sell_volume ?? 0)
    const sellVal = Number(item.sell_value ?? 0)

    totalBuyValue += buyVal
    totalSellValue += sellVal

    const netVol = Number(item.net_volume ?? buyVol - sellVol)
    const netVal = Number(item.net_value ?? buyVal - sellVal)
    const grossVal = buyVal + sellVal

    participants.push({
      brokerCode: item.broker_code.toUpperCase(),
      brokerName: item.broker_name,
      isForeignBroker: Boolean(item.is_foreign),
      buyVolume: buyVol,
      buyValue: buyVal,
      sellVolume: sellVol,
      sellValue: sellVal,
      netVolume: netVol,
      netValue: netVal,
      grossValue: grossVal,
      avgBuyPrice: buyVol > 0 ? Number((buyVal / buyVol).toFixed(2)) : null,
      avgSellPrice: sellVol > 0 ? Number((sellVal / sellVol).toFixed(2)) : null,
    })
  }

  // Sort by net value descending for buyers
  const topBuyers = [...participants]
    .filter((p) => p.netValue > 0)
    .sort((a, b) => b.netValue - a.netValue)

  // Sort by net value ascending (largest negative) for sellers
  const topSellers = [...participants]
    .filter((p) => p.netValue < 0)
    .sort((a, b) => a.netValue - b.netValue)

  // Sort by gross value descending
  const topGross = [...participants].sort((a, b) => b.grossValue - a.grossValue)

  // Concentration calculation
  const sortedByBuyVal = [...participants].sort((a, b) => b.buyValue - a.buyValue)
  const sortedBySellVal = [...participants].sort((a, b) => b.sellValue - a.sellValue)

  const sumBuy = (k: number) => sortedByBuyVal.slice(0, k).reduce((sum, p) => sum + p.buyValue, 0)
  const sumSell = (k: number) =>
    sortedBySellVal.slice(0, k).reduce((sum, p) => sum + p.sellValue, 0)

  const top3BuyConcentration = totalBuyValue > 0 ? sumBuy(3) / totalBuyValue : 0
  const top5BuyConcentration = totalBuyValue > 0 ? sumBuy(5) / totalBuyValue : 0
  const top3SellConcentration = totalSellValue > 0 ? sumSell(3) / totalSellValue : 0
  const top5SellConcentration = totalSellValue > 0 ? sumSell(5) / totalSellValue : 0

  return {
    topBuyers: topBuyers.slice(0, 10),
    topSellers: topSellers.slice(0, 10),
    topGross: topGross.slice(0, 10),
    concentration: {
      top3BuyConcentration: Number(top3BuyConcentration.toFixed(4)),
      top5BuyConcentration: Number(top5BuyConcentration.toFixed(4)),
      top3SellConcentration: Number(top3SellConcentration.toFixed(4)),
      top5SellConcentration: Number(top5SellConcentration.toFixed(4)),
    },
    totalGrossValue: totalBuyValue + totalSellValue,
    totalBuyValue,
    totalSellValue,
  }
}
