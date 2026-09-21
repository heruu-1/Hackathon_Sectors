import type { DivergenceIndicator } from '../lib/contracts/analysis.ts'

export interface NewsImpactInput {
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  impactScore: number // -100 to +100
  catalystType: string
  headlineId: string
  summaryId: string
  isAiGenerated: boolean
  analysisSource: 'GEMINI' | 'RULE_BASED'
  model?: string
}

/**
 * Detects catalyst divergence between news sentiment impact and observed price change.
 *
 * CRITICAL FIXES (F08):
 * 1. priceChangeFraction must represent the observed price response across the news event.
 * 2. When priceChangeFraction is null, divergence status is NO_PRICE_RESPONSE and divergenceScore is null.
 * 3. Never assume 0% when price data is missing.
 */
export function detectCatalystDivergence(
  newsImpact: NewsImpactInput | null | undefined,
  priceChangeFraction: number | null,
  newsTimestamp?: string | null,
): DivergenceIndicator {
  if (!newsImpact) {
    return {
      dataState: 'empty',
      status: 'NO_CATALYST',
      divergenceScore: 30,
      priceChangePct: null,
      headline: null,
      impactScore: null,
      sentiment: 'NEUTRAL',
      catalystType: null,
      verdict: 'Tidak ditemukan katalis berita baru untuk emiten ini.',
      recommendation: 'Pantau arus transaksi dan teknikal secara berkala.',
      newsTimestamp,
    }
  }

  // Missing price comparison cannot be interpreted as 0% move
  if (priceChangeFraction === null || !Number.isFinite(priceChangeFraction)) {
    return {
      dataState: 'partial',
      status: 'NO_PRICE_RESPONSE',
      divergenceScore: null,
      priceChangePct: null,
      headline: newsImpact.headlineId,
      impactScore: newsImpact.impactScore,
      sentiment: newsImpact.sentiment,
      catalystType: newsImpact.catalystType,
      verdict:
        'Respons harga belum dapat dinilai karena penutupan pembanding belum tersedia. Ini adalah indikasi menurut aturan RASI.',
      recommendation: 'Tunggu sesi perdagangan berikutnya untuk memeriksa respon pasar.',
      newsTimestamp,
    }
  }

  const pricePct = Number((priceChangeFraction * 100).toFixed(2))
  const impact = newsImpact.impactScore

  // Scenario 1: Sleeping Giant (High Bullish Catalyst, yet Flat or Dropping Price)
  if (impact >= 40 && pricePct <= 1.5) {
    const divergenceScore = Math.min(100, 60 + Math.abs(impact) * 0.4 - Math.min(pricePct, 0) * 5)
    return {
      dataState: 'ready',
      status: 'SLEEPING_GIANT',
      divergenceScore: Math.round(divergenceScore),
      priceChangePct: pricePct,
      headline: newsImpact.headlineId,
      impactScore: impact,
      sentiment: newsImpact.sentiment,
      catalystType: newsImpact.catalystType,
      verdict: `🚀 SLEEPING GIANT: Katalis positif besar (+${impact}) terbit, namun harga baru bergerak ${pricePct >= 0 ? '+' : ''}${pricePct}%. Pasar belum merespons penuh menurut indikasi aturan RASI.`,
      recommendation: 'Peluang akumulasi awal sebelum respon harga terjadi.',
      newsTimestamp,
    }
  }

  // Scenario 2: Priced In Rally (High Bullish Catalyst and Price Already Jumped)
  if (impact >= 40 && pricePct > 5.0) {
    return {
      dataState: 'ready',
      status: 'PRICED_IN_RALLY',
      divergenceScore: 40,
      priceChangePct: pricePct,
      headline: newsImpact.headlineId,
      impactScore: impact,
      sentiment: newsImpact.sentiment,
      catalystType: newsImpact.catalystType,
      verdict: `Katalis positif (+${impact}) sudah direspons pasar dengan kenaikan harga +${pricePct}% menurut aturan RASI.`,
      recommendation: 'Waspada aksi ambil untung (profit taking) jangka pendek.',
      newsTimestamp,
    }
  }

  // Scenario 3: Delayed Sell-off Risk (High Bearish Catalyst, but Price Has Not Dropped Yet)
  if (impact <= -40 && pricePct >= -1.0) {
    const divergenceScore = Math.min(100, 60 + Math.abs(impact) * 0.4)
    return {
      dataState: 'ready',
      status: 'DELAYED_SELL_OFF_RISK',
      divergenceScore: Math.round(divergenceScore),
      priceChangePct: pricePct,
      headline: newsImpact.headlineId,
      impactScore: impact,
      sentiment: newsImpact.sentiment,
      catalystType: newsImpact.catalystType,
      verdict: `⚠️ RISIKO TERTUNDA: Katalis negatif (${impact}) terbit, namun harga belum terkoreksi (${pricePct >= 0 ? '+' : ''}${pricePct}%). Potensi tekanan jual tertunda menurut aturan RASI.`,
      recommendation: 'Waspada penurunan tajam saat pasar mulai mencerna berita.',
      newsTimestamp,
    }
  }

  return {
    dataState: 'ready',
    status: 'NORMAL_REACTION',
    divergenceScore: 35,
    priceChangePct: pricePct,
    headline: newsImpact.headlineId,
    impactScore: impact,
    sentiment: newsImpact.sentiment,
    catalystType: newsImpact.catalystType,
    verdict: `Respons harga (${pricePct >= 0 ? '+' : ''}${pricePct}%) sejalan dengan intensitas berita menurut aturan RASI.`,
    recommendation: 'Kondisi pasar wajar tanpa divergensi signifikan.',
    newsTimestamp,
  }
}
