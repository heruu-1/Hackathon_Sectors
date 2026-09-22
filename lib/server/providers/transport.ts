import { commitCredits, releaseCredits, reserveCredits } from '../budget.ts'
import { calculateCapabilityCost, getCapability } from './capabilities.ts'

export class SectorsProviderError extends Error {
  statusCode?: number
  code: string

  constructor(message: string, code = 'PROVIDER_ERROR', statusCode?: number) {
    super(message)
    this.name = 'SectorsProviderError'
    this.code = code
    this.statusCode = statusCode
  }
}

export function validateApiKey(apiKey?: string): string {
  const key = apiKey?.trim() || process.env.SECTORS_API_KEY?.trim()
  if (!key || key === 'your_sectors_api_key_here') {
    throw new SectorsProviderError(
      'SECTORS_API_KEY belum diisi pada konfigurasi server.',
      'CONFIG_UNAVAILABLE',
      503,
    )
  }
  return key
}

// Global concurrency queue: max 4 concurrent upstream requests
class ConcurrencyLimiter {
  private activeCount = 0
  private queue: (() => void)[] = []
  private readonly maxConcurrent: number

  constructor(maxConcurrent = 4) {
    this.maxConcurrent = maxConcurrent
  }

  async acquire(): Promise<void> {
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount++
      return
    }
    await new Promise<void>((resolve) => {
      this.queue.push(resolve)
    })
    this.activeCount++
  }

  release(): void {
    this.activeCount--
    if (this.queue.length > 0) {
      const next = this.queue.shift()
      if (next) next()
    }
  }
}

export const upstreamLimiter = new ConcurrencyLimiter(4)

export interface RequestSectorsOptions {
  capabilityId: string
  params?: Record<string, unknown>
  apiKey?: string
  fetchFn?: typeof fetch
  timeoutMs?: number
}

/**
 * Shared, budget-protected, concurrency-limited, sanitized Sectors API transport.
 */
export async function requestSectorsShared<T = unknown>(
  url: string,
  options: RequestSectorsOptions,
): Promise<T> {
  const { capabilityId, params, apiKey, fetchFn = fetch, timeoutMs = 10_000 } = options

  const key = validateApiKey(apiKey)
  const cap = getCapability(capabilityId)
  const cost = calculateCapabilityCost(capabilityId, params)

  // 1. Reserve credits before proceeding
  const reservation = await reserveCredits(capabilityId, cost, url)
  if (!reservation.ok) {
    throw new SectorsProviderError(
      reservation.error ?? 'Anggaran API Sectors tidak mencukupi.',
      'BUDGET_EXHAUSTED',
      429,
    )
  }

  const requestId = reservation.requestId
  const startTime = Date.now()

  // 2. Concurrency limiting (max 2 active requests)
  await upstreamLimiter.acquire()

  try {
    const response = await fetchFn(url, {
      headers: { Authorization: key },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
      redirect: 'error',
    })

    const durationMs = Date.now() - startTime

    if (!response.ok) {
      let detailMessage = ''
      try {
        const errJson = (await response.json()) as Record<string, unknown>
        if (
          errJson &&
          typeof errJson === 'object' &&
          'message' in errJson &&
          typeof errJson.message === 'string'
        ) {
          detailMessage = errJson.message
        }
      } catch {
        // Ignore json parse failure on non-JSON error
      }

      const messages: Record<number, string> = {
        400: detailMessage || 'Kode saham atau parameter tidak valid.',
        401: 'API key Sectors tidak valid atau sudah kedaluwarsa.',
        403: 'API key tidak memiliki akses ke endpoint ini. Periksa paket langganan Sectors Anda.',
        404: 'Kode saham tidak ditemukan atau datanya belum tersedia.',
        429: 'Batas permintaan Sectors tercapai. Tunggu sebentar lalu coba lagi.',
      }
      const message =
        detailMessage ||
        (messages[response.status] ??
          `Sectors sedang bermasalah (HTTP ${response.status}). Coba lagi nanti.`)

      // If client-error 404 or 400, release reserved credits
      if (response.status === 400 || response.status === 404) {
        await releaseCredits(requestId, 'FAILED', response.status, durationMs)
      } else {
        // Other errors might have consumed provider credits
        await commitCredits(requestId, cost, response.status, durationMs)
      }

      throw new SectorsProviderError(message, 'PROVIDER_UNAVAILABLE', response.status)
    }

    // Success: commit credits
    await commitCredits(requestId, cost, response.status, durationMs)
    return (await response.json()) as T
  } catch (err) {
    const durationMs = Date.now() - startTime

    if (err instanceof SectorsProviderError) {
      throw err
    }

    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      await releaseCredits(requestId, 'TIMEOUT', 504, durationMs)
      throw new SectorsProviderError(
        'Sectors belum merespons dalam 10 detik. Silakan coba lagi.',
        'PROVIDER_TIMEOUT',
        504,
      )
    }

    await releaseCredits(requestId, 'FAILED', 503, durationMs)
    throw new SectorsProviderError(
      'Tidak dapat menghubungi Sectors atau membaca responsnya. Silakan coba lagi.',
      'PROVIDER_UNAVAILABLE',
      503,
    )
  } finally {
    upstreamLimiter.release()
  }
}
