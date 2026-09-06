'use server'

import { desc } from 'drizzle-orm'

import { db } from '@/db'
import { anomalies } from '@/db/schema'

export async function getRecentAnomalies() {
  try {
    const recentAnomalies = await db
      .select()
      .from(anomalies)
      .orderBy(desc(anomalies.createdAt))
      .limit(20)
    return { success: true, data: recentAnomalies }
  } catch (error: any) {
    return { error: error.message || 'Failed to fetch recent anomalies.' }
  }
}

export async function analyzeTicker(ticker: string) {
  const apiKey = process.env.SECTORS_API_KEY!
  const cleanTicker = ticker.trim().toUpperCase()

  try {
    const response = await fetch(`https://api.sectors.app/v2/company/report/${cleanTicker}/`, {
      headers: {
        Authorization: apiKey,
        'User-Agent': 'Mozilla/5.0',
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return { error: 'Ticker not found or data unavailable.' }
      }
      return { error: `Failed to fetch data (Status ${response.status})` }
    }

    const data = await response.json()

    // Extract fundamental data for mock anomaly logic
    const companyName = data.company_name || cleanTicker
    const valuation = data.valuation || {}

    // Simple mock "Anomaly Detection" logic based on fundamentals
    let riskScore = 40 // Base risk
    let reasons = []
    let status = 'NORMAL'

    const peRatio = valuation.pe_ttm || 0
    const pbRatio = valuation.pb_mrq || 0

    if (peRatio > 40) {
      riskScore += 25
      reasons.push(`Highly overvalued P/E ratio (${peRatio.toFixed(2)}x).`)
    } else if (peRatio < 0) {
      riskScore += 15
      reasons.push('Negative P/E indicating unprofitability.')
    }

    if (pbRatio > 10) {
      riskScore += 20
      reasons.push(`Extreme P/B ratio (${pbRatio.toFixed(2)}x) detached from book value.`)
    }

    if (riskScore > 80) status = 'CRITICAL'
    else if (riskScore > 60) status = 'HIGH'
    else if (riskScore > 40) status = 'WARNING'

    if (reasons.length === 0) {
      reasons.push('Normal market activity. Valuations are within standard ranges.')
      riskScore = 20
    }

    const umaId = `UMA-${Date.now()}`
    const risk = riskScore > 99 ? 99 : riskScore
    const price = 'Data live'
    const change = 'Live'
    const volumeSpike = 'Live'
    const reasonText = reasons.join(' ')

    // Insert to DB
    const [insertedAnomaly] = await db
      .insert(anomalies)
      .values({
        umaId,
        ticker: cleanTicker,
        name: companyName,
        risk,
        price,
        change,
        volumeSpike,
        status,
        reason: reasonText,
      })
      .returning()

    return {
      success: true,
      data: insertedAnomaly,
    }
  } catch (error: any) {
    return { error: error.message || 'An error occurred during analysis.' }
  }
}
