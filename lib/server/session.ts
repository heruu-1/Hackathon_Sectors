import { headers as nextHeaders } from 'next/headers'

import { auth } from '@/lib/auth'

export interface UserSession {
  id: string
  email: string
  name: string
  image?: string | null
}

export async function getOptionalSession(customHeaders?: Headers): Promise<UserSession | null> {
  try {
    const reqHeaders = customHeaders ?? (await nextHeaders())
    const session = await auth.api.getSession({ headers: reqHeaders })
    if (!session?.user) return null
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    }
  } catch {
    return null
  }
}

export async function requireUserSession(customHeaders?: Headers): Promise<UserSession> {
  const session = await getOptionalSession(customHeaders)
  if (!session) {
    throw new Error('AUTH_REQUIRED: Masuk dengan akun Google untuk melanjutkan.')
  }
  return session
}
