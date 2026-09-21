import { z } from 'zod'

import type { NewsImpactInput } from '../../../domain/divergence.ts'

const BULLISH_KEYWORDS = [
  'akuisisi',
  'merger',
  'laba melonjak',
  'laba naik',
  'tumbuh pesat',
  'dividen jumbo',
  'dividen interim',
  'kontrak baru',
  'tender menang',
  'ekspansi pabrik',
  'buyback saham',
  'peningkatan modal',
  'restrukturisasi tuntas',
  'kinerja positif',
  'rekor baru',
  'surplus',
  'divestasi menguntungkan',
  // English keywords from Sectors API
  'acquisition',
  'acquire',
  'profit jumps',
  'profit surged',
  'net profit up',
  'revenue rises',
  'dividend',
  'contract win',
  'expansion',
  'buyback',
  'surges',
  'soars',
  'record high',
  'restructuring',
  'signs mou',
  'partnership',
]

const BEARISH_KEYWORDS = [
  'rugi bersih',
  'anjlok',
  'diskon parah',
  'gagal bayar',
  'default utang',
  'pkpu',
  'pailit',
  'suspensi',
  'investigasi',
  'sanksi bei',
  'gugatan hukum',
  'kebakaran',
  'penipuan',
  'denda ojk',
  'pemutusan hubungan kerja',
  'penurunan pendapatan',
  'delisting',
  // English keywords
  'net loss',
  'plunges',
  'debt default',
  'bankruptcy',
  'suspension',
  'investigation',
  'sanction',
  'lawsuit',
  'fraud',
  'fine',
  'layoff',
  'revenue drops',
  'outflow',
  'net sell',
]

const GeminiNewsResponseSchema = z.object({
  sentiment: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL']),
  impactScore: z.number().min(-100).max(100),
  catalystType: z.string(),
  headlineId: z.string(),
  summaryId: z.string(),
})

export function fallbackAnalyzeNews(title: string, body: string): NewsImpactInput {
  const content = `${title} ${body}`.toLowerCase()
  let score = 0

  for (const kw of BULLISH_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`, 'i').test(content)) score += 25
  }

  for (const kw of BEARISH_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`, 'i').test(content)) score -= 30
  }

  score = Math.max(-100, Math.min(100, score))

  let sentiment: NewsImpactInput['sentiment'] = 'NEUTRAL'
  if (score >= 25) sentiment = 'BULLISH'
  else if (score <= -25) sentiment = 'BEARISH'

  let catalystType = 'GENERAL'
  if (
    content.includes('akuisisi') ||
    content.includes('merger') ||
    content.includes('acquisition') ||
    content.includes('acquire')
  ) {
    catalystType = 'ACQUISITION'
  } else if (content.includes('dividen') || content.includes('dividend')) {
    catalystType = 'DIVIDEND'
  } else if (
    content.includes('laba') ||
    content.includes('pendapatan') ||
    content.includes('profit') ||
    content.includes('revenue') ||
    content.includes('earnings')
  ) {
    catalystType = 'EARNINGS'
  } else if (
    content.includes('kontrak') ||
    content.includes('tender') ||
    content.includes('contract') ||
    content.includes('mou')
  ) {
    catalystType = 'CONTRACT_WIN'
  } else if (
    content.includes('utang') ||
    content.includes('obligasi') ||
    content.includes('sukuk') ||
    content.includes('debt') ||
    content.includes('bond')
  ) {
    catalystType = 'DEBT'
  }

  const headlineId = title.length > 80 ? `${title.slice(0, 77)}...` : title
  const summaryId =
    sentiment === 'BULLISH'
      ? `Sentimen positif terdeteksi terkait katalis bisnis (${catalystType.toLowerCase()}).`
      : sentiment === 'BEARISH'
        ? `Sentimen negatif terindikasi dari potensi risiko bisnis atau pelepasan aset.`
        : `Berita reguler pasar dengan sentimen netral terhadap pergerakan saham.`

  return {
    sentiment,
    impactScore: score,
    catalystType,
    headlineId,
    summaryId,
    isAiGenerated: false,
    analysisSource: 'RULE_BASED',
  }
}

export async function analyzeNewsImpact(
  title: string,
  body: string,
  symbol?: string,
  apiKey?: string,
  modelName?: string,
  fetchFn: typeof fetch = fetch,
): Promise<NewsImpactInput> {
  const key = apiKey?.trim() || process.env.GEMINI_API_KEY?.trim()
  const model = modelName?.trim() || process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite'

  if (!key || key === 'your_gemini_api_key_here') {
    return fallbackAnalyzeNews(title, body)
  }

  try {
    const prompt = `Anda adalah analis pasar modal Indonesia (IDX) senior. Analisis berita emiten berikut untuk saham ${symbol || 'IDX'}:
Judul: ${title}
Isi: ${body}

Tentukan dalam format JSON:
1. sentiment: BULLISH / BEARISH / NEUTRAL
2. impactScore: skala angka -100 sampai +100
3. catalystType: ACQUISITION, EARNINGS, CONTRACT_WIN, DIVIDEND, REGULATION, DEBT, MANAGEMENT_CHANGE, GENERAL
4. headlineId: judul singkat dalam bahasa Indonesia
5. summaryId: ringkasan dampak bisnis 1-2 kalimat dalam bahasa Indonesia.`

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }

    const response = await fetchFn(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      },
    )

    if (response.ok) {
      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (rawText) {
        const parsedJson = JSON.parse(rawText) as unknown
        const parsed = GeminiNewsResponseSchema.safeParse(parsedJson)
        if (parsed.success) {
          return {
            sentiment: parsed.data.sentiment,
            impactScore: parsed.data.impactScore,
            catalystType: parsed.data.catalystType,
            headlineId: parsed.data.headlineId,
            summaryId: parsed.data.summaryId,
            isAiGenerated: true,
            analysisSource: 'GEMINI',
            model,
          }
        }
      }
    }
  } catch {
    // Fall back to rule-based analysis
  }

  return fallbackAnalyzeNews(title, body)
}
