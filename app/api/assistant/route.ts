import { analyzeTicker } from '@/app/actions'
import { auth } from '@/lib/auth'

type ChatMessage = { role: 'user' | 'assistant'; content: string }
const requestLog = new Map<string, { startedAt: number; count: number }>()
const dailyUsage = new Map<string, { day: string; count: number }>()

function cleanTicker(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const ticker = value.trim().toUpperCase().replace(/\.JK$/i, '')
  return /^[A-Z]{4}$/.test(ticker) ? ticker : undefined
}

function fallbackAnswer(
  message: string,
  ticker?: string,
  snapshot?: { price?: string; change?: string; status?: string; reason?: string },
) {
  if (!ticker)
    return {
      answer:
        'Saya dapat menjelaskan P/E, P/B, akumulasi, distribusi, volume spike, dan transaksi orang dalam. Buka detail saham lalu tanyakan dengan konteks saham tersebut.',
      sources: [],
      proposedAction: null,
      analysisSource: 'RULE_BASED',
    }
  return {
    answer:
      'Untuk ' +
      ticker +
      ', data yang tersedia menunjukkan harga penutupan ' +
      (snapshot?.price ?? 'belum tersedia') +
      ' dengan perubahan ' +
      (snapshot?.change ?? 'belum tersedia') +
      '. Status indikatornya ' +
      (snapshot?.status ?? 'belum tersedia') +
      '. ' +
      (snapshot?.reason ?? 'Belum ada ringkasan yang dapat ditampilkan.') +
      ' Saya belum dapat menyimpulkan arah harga atau memberi rekomendasi transaksi.',
    sources: [{ label: 'Snapshot analisis RASI', date: new Date().toISOString().slice(0, 10) }],
    proposedAction: message.toLowerCase().includes('pantau')
      ? { type: 'ADD_WATCHLIST', ticker, label: 'Simpan ' + ticker + ' ke pantauan' }
      : null,
    analysisSource: 'RULE_BASED',
  }
}

export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof auth.api.getSession>>
  try {
    session = await auth.api.getSession({ headers: request.headers })
  } catch {
    return Response.json(
      {
        error: 'Asisten belum dikonfigurasi. Selesaikan database dan login Google terlebih dahulu.',
      },
      { status: 503 },
    )
  }
  if (!session?.user)
    return Response.json(
      { error: 'Masuk dengan Google untuk memakai Asisten RASI.' },
      { status: 401 },
    )

  const key = 'user:' + session.user.id
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
  const usage = dailyUsage.get(key)
  if (!usage || usage.day !== day) dailyUsage.set(key, { day, count: 1 })
  else if (usage.count >= 20)
    return Response.json(
      {
        error: 'Batas 20 pesan AI hari ini tercapai. Coba lagi setelah reset hari WIB berikutnya.',
      },
      { status: 429 },
    )
  else usage.count += 1

  const now = Date.now()
  const current = requestLog.get(key)
  if (!current || now - current.startedAt > 60_000)
    requestLog.set(key, { startedAt: now, count: 1 })
  else if (current.count >= 5)
    return Response.json(
      { error: 'Batas lima pertanyaan per menit tercapai. Coba lagi sebentar.' },
      { status: 429 },
    )
  else current.count += 1

  let body: { message?: unknown; ticker?: unknown; history?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return Response.json({ error: 'Format permintaan tidak valid.' }, { status: 400 })
  }
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2_000) : ''
  if (!message) return Response.json({ error: 'Pertanyaan tidak boleh kosong.' }, { status: 400 })
  const ticker = cleanTicker(body.ticker)
  const history = Array.isArray(body.history)
    ? (body.history as ChatMessage[])
        .filter(
          (item) =>
            item &&
            (item.role === 'user' || item.role === 'assistant') &&
            typeof item.content === 'string',
        )
        .slice(-8)
    : []

  let snapshot: Awaited<ReturnType<typeof analyzeTicker>>['data'] | undefined
  if (ticker) snapshot = (await analyzeTicker(ticker)).data
  const fallback = fallbackAnswer(message, ticker, snapshot)
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey || apiKey === 'your_gemini_api_key_here')
    return Response.json({ ...fallback, snapshot: snapshot ?? null })

  const context = snapshot
    ? 'Saham: ' +
      snapshot.ticker +
      '\nHarga: ' +
      snapshot.price +
      '\nPerubahan: ' +
      snapshot.change +
      '\nStatus: ' +
      snapshot.status +
      '\nRingkasan: ' +
      snapshot.reason
    : 'Tidak ada konteks saham yang dipilih.'
  const prompt = [
    'Anda adalah Asisten RASI untuk investor pemula Indonesia.',
    'Jelaskan data secara netral, sebutkan tanggal atau keterbatasan bila ada, dan jangan memberi kepastian keuntungan atau instruksi transaksi.',
    'Pisahkan fakta dari interpretasi. Jawab dalam bahasa Indonesia sederhana.',
    'Konteks data:\n' + context,
    'Percakapan sebelumnya:\n' + history.map((item) => item.role + ': ' + item.content).join('\n'),
    'Pertanyaan pengguna:\n' + message,
    'Kembalikan JSON: {\"answer\":\"...\",\"sources\":[{\"label\":\"...\",\"date\":\"...\"}],\"proposedAction\":null atau {\"type\":\"ADD_WATCHLIST\",\"ticker\":\"XXXX\",\"label\":\"...\"}}',
  ].join('\n\n')
  try {
    const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3-flash-preview'
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' +
        model +
        ':generateContent?key=' +
        encodeURIComponent(apiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(30_000),
      },
    )
    if (!response.ok)
      return Response.json({
        ...fallback,
        snapshot: snapshot ?? null,
        warning: 'Gemini belum merespons; jawaban berbasis data lokal.',
      })
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return Response.json({ ...fallback, snapshot: snapshot ?? null })
    const parsed = JSON.parse(text) as {
      answer?: string
      sources?: Array<{ label?: string; date?: string }>
      proposedAction?: { type?: string; ticker?: string; label?: string } | null
    }
    const proposedTicker = cleanTicker(parsed.proposedAction?.ticker)
    return Response.json({
      answer: typeof parsed.answer === 'string' ? parsed.answer : fallback.answer,
      sources: Array.isArray(parsed.sources) ? parsed.sources.slice(0, 5) : fallback.sources,
      proposedAction:
        parsed.proposedAction?.type === 'ADD_WATCHLIST' && proposedTicker
          ? {
              type: 'ADD_WATCHLIST',
              ticker: proposedTicker,
              label: parsed.proposedAction.label || 'Simpan ke pantauan',
            }
          : null,
      analysisSource: 'GEMINI',
      model,
      snapshot: snapshot ?? null,
    })
  } catch {
    return Response.json({
      ...fallback,
      snapshot: snapshot ?? null,
      warning: 'Gemini tidak tersedia; jawaban berbasis data lokal.',
    })
  }
}
