import { headers } from 'next/headers'

import { auth } from '@/lib/auth'

export async function getCurrentUserId(): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user.id ?? null
  } catch {
    return null
  }
}

export function parsePriority(val?: string): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (val === 'HIGH' || val === 'LOW') return val
  return 'MEDIUM'
}

export function parseStatus(
  val?: string,
): 'WATCHING' | 'ACCUMULATING' | 'SLEEPING_GIANT' | 'BOUGHT' {
  if (val === 'ACCUMULATING' || val === 'SLEEPING_GIANT' || val === 'BOUGHT') return val
  return 'WATCHING'
}

export function parseOptionalPriority(val?: string): 'LOW' | 'MEDIUM' | 'HIGH' | undefined {
  if (val === 'HIGH' || val === 'LOW' || val === 'MEDIUM') return val
  return undefined
}

export function parseOptionalStatus(
  val?: string,
): 'WATCHING' | 'ACCUMULATING' | 'SLEEPING_GIANT' | 'BOUGHT' | undefined {
  if (
    val === 'ACCUMULATING' ||
    val === 'SLEEPING_GIANT' ||
    val === 'BOUGHT' ||
    val === 'WATCHING'
  ) {
    return val
  }
  return undefined
}
