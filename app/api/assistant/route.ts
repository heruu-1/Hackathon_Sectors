import { auth } from '@/lib/auth'
import { sendMessage } from '@/lib/server/services/assistant'

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

  if (!session?.user) {
    return Response.json(
      { error: 'Masuk dengan Google untuk memakai Asisten RASI.' },
      { status: 401 },
    )
  }

  let body: {
    message?: unknown
    ticker?: unknown
    conversationId?: unknown
    snapshotId?: unknown
    requestKey?: unknown
  }

  try {
    body = (await request.json()) as typeof body
  } catch {
    return Response.json({ error: 'Format permintaan tidak valid.' }, { status: 400 })
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) {
    return Response.json({ error: 'Pertanyaan tidak boleh kosong.' }, { status: 400 })
  }

  const ticker =
    typeof body.ticker === 'string' && body.ticker.trim()
      ? body.ticker.trim().toUpperCase().replace(/\.JK$/i, '')
      : undefined

  const conversationId =
    typeof body.conversationId === 'string' && body.conversationId.trim()
      ? body.conversationId.trim()
      : undefined

  const snapshotId =
    typeof body.snapshotId === 'string' && body.snapshotId.trim()
      ? body.snapshotId.trim()
      : undefined

  const requestKey =
    typeof body.requestKey === 'string' && body.requestKey.trim()
      ? body.requestKey.trim()
      : crypto.randomUUID()

  try {
    const result = await sendMessage(session.user.id, {
      message,
      ticker: ticker && /^[A-Z]{4}$/.test(ticker) ? ticker : undefined,
      conversationId,
      snapshotId,
      requestKey,
    })

    if (!result.ok) {
      const statusMap: Record<string, number> = {
        VALIDATION_ERROR: 400,
        AUTH_REQUIRED: 401,
        NOT_FOUND: 404,
        RATE_LIMITED: 429,
        BUDGET_EXHAUSTED: 429,
        CONFIG_UNAVAILABLE: 503,
        PROVIDER_UNAVAILABLE: 503,
        DATABASE_UNAVAILABLE: 503,
        INTERNAL_ERROR: 500,
      }
      const status = statusMap[result.error.code] ?? 500
      return Response.json({ error: result.error.message }, { status })
    }

    return Response.json(result.data)
  } catch (error) {
    console.error('Error in /api/assistant:', error)
    return Response.json(
      { error: 'Terjadi kendala internal saat memproses permintaan asisten.' },
      { status: 500 },
    )
  }
}
