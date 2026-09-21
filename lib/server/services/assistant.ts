import { z } from 'zod'

import {
  type AssistantRequest,
  AssistantRequestSchema,
  type AssistantResponseDTO,
  type AssistantSourceRef,
  type ConversationDTO,
  type ProposedAction,
  ProposedActionSchema,
} from '../../contracts/assistant.ts'
import { type Result, errorResult, successResult } from '../../contracts/result.ts'
import { withIdempotency } from '../idempotency.ts'
import { consumeQuota } from '../quota.ts'
import {
  addConversationMessage,
  createConversation,
  deleteConversation,
  getConversation,
  getConversationMessages,
  getUserConversations,
} from '../repositories/conversations.ts'
import { getLatestSnapshotByTicker, getSnapshotById } from '../repositories/snapshots.ts'
import { fetchLiveMarketQuote, type LiveMarketQuote } from '../providers/market.ts'

const GeminiAssistantOutputSchema = z.object({
  answer: z.string(),
  proposedAction: ProposedActionSchema.nullable().optional(),
  warnings: z.array(z.string()).optional(),
})

function buildSourcesFromSnapshot(
  snapshot: {
    ticker: string
    priceDate?: string | null
    indicators?: {
      bandarmology?: { date?: string | null }
      volume?: { dateRange?: { end?: string | null } }
    }
  } | null,
): AssistantSourceRef[] {
  if (!snapshot) {
    return [
      {
        label: 'Panduan Metodologi Riset Saham RASI',
        date: new Date().toISOString().split('T')[0],
      },
    ]
  }

  const sources: AssistantSourceRef[] = [
    {
      label: `Valuasi Fundamental & Harga Pasar ${snapshot.ticker} (Sectors)`,
      date: snapshot.priceDate ?? undefined,
    },
    {
      label: `Ringkasan Broker & Arus Asing ${snapshot.ticker} (Sectors)`,
      date: snapshot.indicators?.bandarmology?.date ?? undefined,
    },
    {
      label: `Volume Transaksi Historis ${snapshot.ticker} (Sectors)`,
      date: snapshot.indicators?.volume?.dateRange?.end ?? undefined,
    },
    {
      label: `Pelaporan Transaksi Orang Dalam ${snapshot.ticker} (Sectors)`,
      date: snapshot.priceDate ?? undefined,
    },
  ]

  return sources
}

function generateRuleBasedAnswer(
  message: string,
  ticker?: string,
  snapshot?: {
    ticker: string
    companyName: string
    price: number | null
    composite?: { score: number | null; status: string; reason: string }
    indicators?: {
      fundamental?: { status: string; pe: number | null; pb: number | null }
      bandarmology?: {
        status: string
        foreignFlowStatus: string
        cr3Buy: number | null
        cr3Sell: number | null
      }
      divergence?: { status: string; sentiment: string; verdict: string }
      insider?: { status: string; summary: string }
      volume?: { status: string; formattedRatio: string }
    }
  } | null,
  liveQuote?: LiveMarketQuote | null,
): { answer: string; proposedAction: ProposedAction | null; warnings: string[] } {
  const lower = message.toLowerCase()
  const cleanTicker = ticker ? ticker.trim().toUpperCase() : null

  let proposedAction: ProposedAction | null = null
  if (
    cleanTicker &&
    (lower.includes('watchlist') ||
      lower.includes('pantau') ||
      lower.includes('simpan') ||
      lower.includes('masukkan'))
  ) {
    proposedAction = {
      type: 'ADD_WATCHLIST',
      ticker: cleanTicker,
      label: `Pantau ${cleanTicker} di Watchlist`,
    }
  }

  const warnings = [
    'Analisis ini berbasis data historis dan aturan RASI, bukan saran atau rekomendasi investasi.',
  ]

  const liveLines =
    liveQuote && liveQuote.price
      ? [
          `### Harga Pasar Real-Time **${cleanTicker}** (${liveQuote.timestamp ?? 'Detik Ini'}):`,
          `- **Harga Terakhir**: Rp${liveQuote.price.toLocaleString('id-ID')} (${liveQuote.changePercent ?? '0%'})`,
          `- **Perubahan**: ${liveQuote.change !== null && liveQuote.change > 0 ? '+' : ''}${liveQuote.change?.toLocaleString('id-ID') ?? '-'}`,
          `- **Rentang Hari Ini (Low - High)**: Rp${liveQuote.dayLow?.toLocaleString('id-ID') ?? '-'} — Rp${liveQuote.dayHigh?.toLocaleString('id-ID') ?? '-'}`,
          `- **Volume Transaksi**: ${liveQuote.volume?.toLocaleString('id-ID') ?? '-'} lembar`,
          `- **Sumber Data**: ${liveQuote.source}`,
          '',
        ]
      : []

  if (snapshot) {
    const comp = snapshot.composite
    const bandar = snapshot.indicators?.bandarmology
    const fund = snapshot.indicators?.fundamental
    const div = snapshot.indicators?.divergence
    const ins = snapshot.indicators?.insider

    const answer = [
      ...liveLines,
      `Berikut adalah ringkasan indikator RASI untuk **${snapshot.ticker}** (${snapshot.companyName}):`,
      `- **Harga Terakhir**: Rp${snapshot.price?.toLocaleString('id-ID') ?? '-'}`,
      `- **Skor Komposit**: ${comp?.score !== null && comp?.score !== undefined ? `${comp.score}/100 (${comp.status})` : 'Belum lengkap (INSUFFICIENT_DATA)'}`,
      `- **Bandarmologi**: ${bandar?.status ?? '-'} | Arus Asing: ${bandar?.foreignFlowStatus ?? '-'}`,
      `- **Fundamental**: P/E ${fund?.pe?.toFixed(2) ?? '-'}x | P/B ${fund?.pb?.toFixed(2) ?? '-'}x (${fund?.status ?? '-'})`,
      `- **Divergensi Katalis**: ${div?.status ?? '-'} (${div?.sentiment ?? 'NEUTRAL'})`,
      `- **Insider**: ${ins?.status ?? '-'} (${ins?.summary ?? 'Tidak ada transaksi signifikan'})`,
      '',
      comp?.reason ? `*Catatan*: ${comp.reason}` : '',
      div?.verdict ? `*Katalis*: ${div.verdict}` : '',
    ]
      .filter((line) => line !== '')
      .join('\n')

    return { answer, proposedAction, warnings }
  }

  if (cleanTicker) {
    if (liveLines.length > 0) {
      const answer = [
        ...liveLines,
        `*Catatan*: Indikator 4 pilar (Bandarmologi, Fundamental, Divergensi Katalis, dan Insider) untuk **${cleanTicker}** belum tersimpan di snapshot lokal. Buka menu analisis saham untuk memuat evaluasi lengkapnya.`,
      ].join('\n')
      return { answer, proposedAction, warnings }
    }

    const answer = [
      `Data snapshot untuk emiten **${cleanTicker}** belum tersedia di database.`,
      `Silakan buka menu analisis saham atau cari kode **${cleanTicker}** di halaman utama terlebih dahulu agar data indikator 4 pilar terunduh.`,
      `Setelah itu, tanyakan kembali di sini untuk analisis komprehensif ${cleanTicker}.`,
    ].join('\n\n')
    return { answer, proposedAction, warnings }
  }

  const answer = [
    'Halo! Saya asisten riset RASI untuk Bursa Efek Indonesia (IDX).',
    'Anda dapat menanyakan analisis 4 pilar (Fundamental, Bandarmologi, Divergensi Katalis, dan Transaksi Insider) untuk kode saham tertentu seperti BBCA, BBRI, ASII, atau TLKM.',
    'Ketikkan kode saham yang ingin Anda telaah untuk melihat snapshot indikator lengkap.',
  ].join('\n\n')

  return { answer, proposedAction, warnings }
}

export async function sendMessage(
  userId: string,
  rawInput: AssistantRequest,
): Promise<Result<AssistantResponseDTO>> {
  if (!userId) {
    return errorResult('AUTH_REQUIRED', 'Anda harus masuk untuk menggunakan asisten.')
  }

  const parseResult = AssistantRequestSchema.safeParse(rawInput)
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0]?.message ?? 'Format permintaan tidak valid.'
    return errorResult('VALIDATION_ERROR', firstIssue)
  }
  const request = parseResult.data

  return withIdempotency(userId, 'assistant', request.requestKey, async () => {
    // 1. Quota check
    const quotaResult = await consumeQuota(userId, 'assistant')
    if (!quotaResult.ok) {
      return quotaResult
    }

    // 2. Resolve or create conversation
    let convId = request.conversationId
    if (convId) {
      const existing = await getConversation(userId, convId)
      if (!existing) {
        // Fallback: create new conversation
        const title = request.ticker
          ? `Tanya ${request.ticker}`
          : request.message.slice(0, 40) + '...'
        const created = await createConversation(userId, title, request.ticker)
        convId = created.id
      }
    } else {
      const title = request.ticker
        ? `Tanya ${request.ticker}`
        : request.message.slice(0, 40) + '...'
      const created = await createConversation(userId, title, request.ticker)
      convId = created.id
    }

    // 3. Retrieve bounded context (last 8 messages)
    const priorMessages = await getConversationMessages(convId, 8)

    // 4. Retrieve snapshot and live market quote if available (with auto-detect ticker from message)
    let snapshot = null
    let effectiveTicker = request.ticker
    if (!effectiveTicker) {
      const match = request.message.match(/\b([A-Za-z]{4})\b/)
      if (match) {
        effectiveTicker = match[1].toUpperCase()
      } else if (/\bbri\b/i.test(request.message)) {
        effectiveTicker = 'BBRI'
      } else if (/\bbca\b/i.test(request.message)) {
        effectiveTicker = 'BBCA'
      } else if (/\bmandiri\b/i.test(request.message)) {
        effectiveTicker = 'BMRI'
      } else if (/\bbni\b/i.test(request.message)) {
        effectiveTicker = 'BBNI'
      } else if (/\btelkom\b/i.test(request.message)) {
        effectiveTicker = 'TLKM'
      } else if (/\bastra\b/i.test(request.message)) {
        effectiveTicker = 'ASII'
      }
    }

    const [snapshotResult, liveQuote] = await Promise.all([
      request.snapshotId
        ? getSnapshotById(request.snapshotId)
        : effectiveTicker
          ? getLatestSnapshotByTicker(effectiveTicker)
          : Promise.resolve(null),
      effectiveTicker ? fetchLiveMarketQuote(effectiveTicker) : Promise.resolve(null),
    ])
    snapshot = snapshotResult

    // 5. Build sources
    const sources = buildSourcesFromSnapshot(snapshot)
    if (liveQuote && effectiveTicker) {
      sources.unshift({
        label: `Harga Pasar Real-Time ${effectiveTicker} (${liveQuote.source})`,
        date: liveQuote.timestamp ?? undefined,
        url: `https://finance.yahoo.com/quote/${effectiveTicker}.JK`,
      })
    }

    // 6. Invoke Gemini or fallback
    const key = process.env.GEMINI_API_KEY?.trim()
    const primaryModel = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite'
    const candidateModels = Array.from(
      new Set([primaryModel, 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite'])
    )

    let answer = ''
    let proposedAction: ProposedAction | null = null
    let analysisSource: 'GEMINI' | 'RULE_BASED' = 'RULE_BASED'
    let usedModel: string | undefined = undefined
    let warnings: string[] = [
      'Analisis ini berbasis data historis dan aturan RASI, bukan rekomendasi investasi.',
    ]

    if (key && key !== 'your_gemini_api_key_here') {
      const historyText = priorMessages
        .map((m) => `${m.role === 'user' ? 'Pengguna' : 'Asisten'}: ${m.content}`)
        .join('\n')

      const prompt = `Anda adalah Asisten Riset Saham Indonesia RASI (analis objektif berbasis aturan IDX).
Pedoman utama:
- Berikan analisis objektif, ringkas, dan jelas dalam Bahasa Indonesia.
- Jangan pernah memberikan rekomendasi beli/jual atau target harga pasti ("bukan saran finansial").
- Selalu utamakan menggunakan "Data Pasar Real-Time Detik Ini dari Internet" di bawah untuk menjawab pertanyaan mengenai harga saham saat ini, pergerakan hari ini, rentang harga, dan volume perdagangan secara akurat.
- Sebutkan data, angka rasio, dan status indikator jika tersedia.
- Jika pengguna ingin menyimpan/memantau saham ke watchlist, Anda dapat menyertakan proposedAction dengan format: {"type": "ADD_WATCHLIST", "ticker": "XXXX", "label": "Pantau XXXX di Watchlist"}. Jika tidak ada permintaan memantau, set proposedAction ke null.

Konteks Percakapan Sebelumnya (maksimal 8 pesan):
${historyText || '(Belum ada percakapan)'}

Data Pasar Real-Time Detik Ini dari Internet (Bursa Efek Indonesia):
${liveQuote ? JSON.stringify(liveQuote, null, 2) : 'Data pasar real-time khusus tidak tersedia/tidak terdeteksi.'}

Data Snapshot Indikator 4 Pilar RASI:
${snapshot ? JSON.stringify(snapshot, null, 2) : 'Data snapshot belum dipilih/tidak tersedia.'}

Pertanyaan Pengguna:
${request.message}

Keluarkan respons dalam format JSON dengan properti:
{
  "answer": "isi jawaban dalam format markdown bahasa Indonesia",
  "proposedAction": null atau {"type": "ADD_WATCHLIST", "ticker": "KODE", "label": "label aksi"},
  "warnings": ["peringatan disclaimer"]
}`

      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }

      for (const modelToUse of candidateModels) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${key}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(25_000),
            },
          )

          if (res.ok) {
            const data = (await res.json()) as {
              candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
            }
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text
            if (rawText) {
              const parsed = GeminiAssistantOutputSchema.safeParse(JSON.parse(rawText))
              if (parsed.success) {
                answer = parsed.data.answer
                proposedAction = parsed.data.proposedAction ?? null
                if (parsed.data.warnings && parsed.data.warnings.length > 0) {
                  warnings = parsed.data.warnings
                }
                analysisSource = 'GEMINI'
                usedModel = modelToUse
                break
              }
            }
          }
        } catch {
          // Try next candidate model
        }
      }
    }

    if (!answer) {
      const fallback = generateRuleBasedAnswer(request.message, effectiveTicker, snapshot, liveQuote)
      answer = fallback.answer
      proposedAction = fallback.proposedAction
      warnings = fallback.warnings
      analysisSource = 'RULE_BASED'
    }

    // 7. Persist user message and assistant message
    await addConversationMessage(convId, {
      role: 'user',
      content: request.message,
      snapshotId: snapshot?.id,
    })

    const assistantMsg = await addConversationMessage(convId, {
      role: 'assistant',
      content: answer,
      analysisSource,
      sources,
      proposedAction,
      snapshotId: snapshot?.id,
    })

    const responseDTO: AssistantResponseDTO = {
      conversationId: convId,
      messageId: assistantMsg.id,
      answer,
      sources,
      proposedAction,
      analysisSource,
      model: analysisSource === 'GEMINI' ? usedModel : undefined,
      warnings,
    }

    return successResult(responseDTO)
  })
}

export async function listConversations(userId: string): Promise<Result<ConversationDTO[]>> {
  if (!userId) {
    return errorResult('AUTH_REQUIRED', 'Anda harus masuk untuk melihat daftar percakapan.')
  }
  const convs = await getUserConversations(userId)
  return successResult(convs)
}

export async function getConversationDetail(
  userId: string,
  conversationId: string,
): Promise<Result<ConversationDTO>> {
  if (!userId) {
    return errorResult('AUTH_REQUIRED', 'Anda harus masuk untuk melihat percakapan.')
  }
  const conv = await getConversation(userId, conversationId)
  if (!conv) {
    return errorResult('NOT_FOUND', 'Percakapan tidak ditemukan.')
  }
  return successResult(conv)
}

export async function deleteConversationById(
  userId: string,
  conversationId: string,
): Promise<Result<{ success: boolean }>> {
  if (!userId) {
    return errorResult('AUTH_REQUIRED', 'Anda harus masuk untuk menghapus percakapan.')
  }
  const deleted = await deleteConversation(userId, conversationId)
  if (!deleted) {
    return errorResult('NOT_FOUND', 'Percakapan tidak ditemukan.')
  }
  return successResult({ success: true })
}
