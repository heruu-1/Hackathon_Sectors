import { toNextJsHandler } from 'better-auth/next-js'

import { auth, isAuthSecretValid } from '@/lib/auth'

const handler = toNextJsHandler(auth)

export async function GET(request: Request) {
  if (!isAuthSecretValid()) {
    return Response.json(
      { error: 'Autentikasi belum dikonfigurasi dengan aman di server produksi.' },
      { status: 503 },
    )
  }
  return handler.GET(request)
}

export async function POST(request: Request) {
  if (!isAuthSecretValid()) {
    return Response.json(
      { error: 'Autentikasi belum dikonfigurasi dengan aman di server produksi.' },
      { status: 503 },
    )
  }
  return handler.POST(request)
}
