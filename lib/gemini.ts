export interface GeminiNewsImpact {
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  impactScore: number // -100 to +100
  catalystType:
    | 'ACQUISITION'
    | 'EARNINGS'
    | 'CONTRACT_WIN'
    | 'DIVIDEND'
    | 'REGULATION'
    | 'DEBT'
    | 'MANAGEMENT_CHANGE'
    | 'GENERAL'
  headlineId: string
  summaryId: string
  isAiGenerated: boolean
}

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
]

export async function analyzeNewsImpact(
  title: string,
  body: string,
  symbol?: string,
  apiKey: string | undefined = process.env.GEMINI_API_KEY,
): Promise<GeminiNewsImpact> {
  const key = apiKey?.trim()

  if (key && key !== 'your_gemini_api_key_here') {
    try {
      const prompt = `Anda adalah analis pasar modal Indonesia (IDX) senior. Analisis berita emiten berikut untuk saham ${symbol || 'IDX'}:
Judul: ${title}
Isi: ${body}

Tentukan:
1. Sentimen bisnis emiten (BULLISH / BEARISH / NEUTRAL)
2. Skor dampak pasar skala -100 (sangat buruk/merugikan) sampai +100 (katalis luar biasa positif)
3. Kategori katalis: ACQUISITION, EARNINGS, CONTRACT_WIN, DIVIDEND, REGULATION, DEBT, MANAGEMENT_CHANGE, GENERAL
4. Judul singkat dalam bahasa Indonesia
5. Ringkasan dampak bisnis 1-2 kalimat dalam bahasa Indonesia.`

      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }

      for (const modelName of ['gemini-3-flash-preview', 'gemini-3.5-flash']) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(8000),
            },
          )

          if (response.ok) {
            const data = await response.json()
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text
            if (text) {
              const parsed = JSON.parse(text) as GeminiNewsImpact
              return {
                sentiment: parsed.sentiment ?? 'NEUTRAL',
                impactScore: Number.isFinite(parsed.impactScore) ? parsed.impactScore : 0,
                catalystType: parsed.catalystType ?? 'GENERAL',
                headlineId: parsed.headlineId ?? title,
                summaryId: parsed.summaryId ?? body.slice(0, 150),
                isAiGenerated: true,
              }
            }
          }
        } catch {
          // Try next model or fallback
        }
      }
    } catch {
      // Fall through to heuristic fallback
    }
  }

  // Heuristic Rule-based Fallback
  return fallbackAnalyzeNews(title, body)
}

export function fallbackAnalyzeNews(title: string, body: string): GeminiNewsImpact {
  const content = `${title} ${body}`.toLowerCase()

  let score = 0

  for (const kw of BULLISH_KEYWORDS) {
    if (content.includes(kw)) {
      score += 25
    }
  }

  for (const kw of BEARISH_KEYWORDS) {
    if (content.includes(kw)) {
      score -= 30
    }
  }

  score = Math.max(-100, Math.min(100, score))

  let sentiment: GeminiNewsImpact['sentiment'] = 'NEUTRAL'
  if (score >= 25) sentiment = 'BULLISH'
  else if (score <= -25) sentiment = 'BEARISH'

  let catalystType: GeminiNewsImpact['catalystType'] = 'GENERAL'
  if (content.includes('akuisisi') || content.includes('merger')) catalystType = 'ACQUISITION'
  else if (content.includes('dividen')) catalystType = 'DIVIDEND'
  else if (content.includes('laba') || content.includes('pendapatan')) catalystType = 'EARNINGS'
  else if (content.includes('kontrak') || content.includes('tender')) catalystType = 'CONTRACT_WIN'
  else if (content.includes('utang') || content.includes('obligasi') || content.includes('sukuk'))
    catalystType = 'DEBT'

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
  }
}
