import type { GeminiNewsImpact } from './gemini.ts'

export interface CatalystDivergence {
  status:
    | 'SLEEPING_GIANT'
    | 'PRICED_IN_RALLY'
    | 'DELAYED_SELL_OFF_RISK'
    | 'NORMAL_REACTION'
    | 'NO_CATALYST'
  divergenceScore: number // 0 to 100 (100 = huge unpriced opportunity or extreme anomaly)
  priceChangePct: number
  headline: string
  impactScore: number
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  catalystType: string
  verdict: string
  recommendation: string
  newsTimestamp?: string
}

export function detectCatalystDivergence(
  newsImpact: GeminiNewsImpact | null,
  priceChangeFraction: number | null, // e.g. -0.015 (-1.5%)
  newsTimestamp?: string,
): CatalystDivergence {
  if (!newsImpact) {
    return {
      status: 'NO_CATALYST',
      divergenceScore: 30,
      priceChangePct: 0,
      headline: 'Belum ada berita katalis terkini',
      impactScore: 0,
      sentiment: 'NEUTRAL',
      catalystType: 'GENERAL',
      verdict: 'Tidak ditemukan katalis berita baru untuk emiten ini.',
      recommendation: 'Pantau arus transaksi dan teknikal secara berkala.',
      newsTimestamp,
    }
  }

  const pricePct = priceChangeFraction !== null ? Number((priceChangeFraction * 100).toFixed(2)) : 0
  const impact = newsImpact.impactScore

  // Scenario 1: Sleeping Giant (High Bullish Catalyst, yet Flat or Dropping Price)
  if (impact >= 40 && pricePct <= 1.5) {
    const divergenceScore = Math.min(100, 60 + Math.abs(impact) * 0.4 - Math.min(pricePct, 0) * 5)
    return {
      status: 'SLEEPING_GIANT',
      divergenceScore: Math.round(divergenceScore),
      priceChangePct: pricePct,
      headline: newsImpact.headlineId,
      impactScore: impact,
      sentiment: newsImpact.sentiment,
      catalystType: newsImpact.catalystType,
      verdict: `🚀 SLEEPING GIANT: Katalis positif besar (+${impact}) terbit, namun harga baru bergerak ${pricePct >= 0 ? '+' : ''}${pricePct}%. Pasar belum mengantisipasi berita ini secara penuh.`,
      recommendation: 'Peluang akumulasi awal sebelum pergerakan harga terjadi.',
      newsTimestamp,
    }
  }

  // Scenario 2: Priced In Rally (High Bullish Catalyst and Price Already Flew)
  if (impact >= 40 && pricePct > 5.0) {
    return {
      status: 'PRICED_IN_RALLY',
      divergenceScore: 40,
      priceChangePct: pricePct,
      headline: newsImpact.headlineId,
      impactScore: impact,
      sentiment: newsImpact.sentiment,
      catalystType: newsImpact.catalystType,
      verdict: `Katalis positif (+${impact}) sudah direspons pasar dengan lonjakan harga +${pricePct}%.`,
      recommendation: 'Hati-hati aksi profit taking / buy on rumor sell on news.',
      newsTimestamp,
    }
  }

  // Scenario 3: Delayed Sell-off Hazard (High Bearish Catalyst, but Price Has Not Dropped Yet)
  if (impact <= -40 && pricePct >= -1.0) {
    const divergenceScore = Math.min(100, 60 + Math.abs(impact) * 0.4)
    return {
      status: 'DELAYED_SELL_OFF_RISK',
      divergenceScore: Math.round(divergenceScore),
      priceChangePct: pricePct,
      headline: newsImpact.headlineId,
      impactScore: impact,
      sentiment: newsImpact.sentiment,
      catalystType: newsImpact.catalystType,
      verdict: `⚠️ DELAYED RISK: Katalis negatif (${impact}) terbit, namun harga belum terkoreksi (${pricePct >= 0 ? '+' : ''}${pricePct}%). Potensi tekanan jual tertunda.`,
      recommendation: 'Waspada penurunan tajam saat pasar mulai mencerna berita.',
      newsTimestamp,
    }
  }

  return {
    status: 'NORMAL_REACTION',
    divergenceScore: 35,
    priceChangePct: pricePct,
    headline: newsImpact.headlineId,
    impactScore: impact,
    sentiment: newsImpact.sentiment,
    catalystType: newsImpact.catalystType,
    verdict: `Respons harga (${pricePct >= 0 ? '+' : ''}${pricePct}%) sejalan dengan intensitas berita.`,
    recommendation: 'Kondisi pasar normal tanpa divergensi signifikan.',
    newsTimestamp,
  }
}
