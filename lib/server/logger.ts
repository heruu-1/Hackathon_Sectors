import crypto from 'node:crypto'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const SENSITIVE_KEYS_REGEX = /password|secret|token|apikey|authorization|cookie|bearer|credential/i

/**
 * Anonymizes and hashes user ID so logs can be correlated without storing PII.
 */
export function sanitizeUserId(userId?: string | null): string {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    return 'anonymous'
  }
  const hash = crypto.createHash('sha256').update(userId.trim()).digest('hex')
  return `usr_${hash.slice(0, 12)}`
}

/**
 * Deeply sanitizes metadata objects, masking keys containing sensitive data.
 */
export function sanitizeMetadata(data: unknown, depth = 0): unknown {
  if (depth > 5 || data === null || data === undefined) return data

  if (typeof data === 'string') {
    if (data.length > 2000) {
      return `${data.slice(0, 2000)}... [TRUNCATED]`
    }
    return data
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeMetadata(item, depth + 1))
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEYS_REGEX.test(key)) {
        sanitized[key] = '[REDACTED]'
      } else if (key.toLowerCase().includes('userid') && typeof value === 'string') {
        sanitized[key] = sanitizeUserId(value)
      } else {
        sanitized[key] = sanitizeMetadata(value, depth + 1)
      }
    }
    return sanitized
  }

  return data
}

export interface StructuredLog {
  timestamp: string
  level: LogLevel
  message: string
  service: string
  environment: string
  context?: Record<string, unknown>
  error?: {
    name: string
    message: string
    stack?: string
  }
}

function writeLog(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
  error?: unknown,
) {
  const isProd = process.env.NODE_ENV === 'production'
  const timestamp = new Date().toISOString()

  let errObj: StructuredLog['error'] | undefined
  if (error instanceof Error) {
    errObj = {
      name: error.name,
      message: error.message,
      stack: isProd ? undefined : error.stack,
    }
  } else if (error && typeof error === 'object') {
    errObj = {
      name: 'UnknownError',
      message: String(error),
    }
  }

  const logPayload: StructuredLog = {
    timestamp,
    level,
    message,
    service: 'rasi',
    environment: process.env.NODE_ENV || 'development',
    context: meta ? (sanitizeMetadata(meta) as Record<string, unknown>) : undefined,
    error: errObj,
  }

  const logString = JSON.stringify(logPayload)

  if (level === 'error') {
    console.error(logString)
  } else if (level === 'warn') {
    console.warn(logString)
  } else if (level === 'debug') {
    if (process.env.DEBUG || process.env.NODE_ENV !== 'production') {
      console.debug(logString)
    }
  } else {
    console.log(logString)
  }
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    writeLog('debug', message, meta)
  },
  info(message: string, meta?: Record<string, unknown>) {
    writeLog('info', message, meta)
  },
  warn(message: string, meta?: Record<string, unknown>) {
    writeLog('warn', message, meta)
  },
  error(message: string, error?: unknown, meta?: Record<string, unknown>) {
    writeLog('error', message, meta, error)
  },
}
