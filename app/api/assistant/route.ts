import { auth } from '@/lib/auth'
import { isFeatureEnabled } from '@/lib/server/env'
import { sendMessage } from '@/lib/server/services/assistant'

export async function GET() {
  return Response.json(
    {
      status: 'ok',
      service: 'RASI Assistant API',
      version: '0.1.0',
      description:
        'Kirimkan POST request dengan format { message, ticker? } untuk bertanya ke asisten.',
    },
    { status: 200 },
  )
}

export async function POST(request: Request) {
  if (!isFeatureEnabled('RASI_ASSISTANT_ENABLED')) {
    return Response.json({ error: 'Fitur asisten AI saat ini dinonaktifkan.' }, { status: 503 })
  }

  let session: Awaited<ReturnType<typeof auth.api.getSession>> = null
  try {
    session = await auth.api.getSession({ headers: request.headers })
  } catch {
    // Gracefully proceed with guest session if auth check fails
  }

  const userId = session?.user?.id ?? 'guest-user'

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
    const result = await sendMessage(userId, {
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
        FEATURE_DISABLED: 503,
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
