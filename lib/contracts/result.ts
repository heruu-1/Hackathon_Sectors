export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTH_REQUIRED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FEATURE_DISABLED'
  | 'RATE_LIMITED'
  | 'BUDGET_EXHAUSTED'
  | 'CONFIG_UNAVAILABLE'
  | 'PROVIDER_UNAVAILABLE'
  | 'DATABASE_UNAVAILABLE'
  | 'INTERNAL_ERROR'

export interface ErrorDetail {
  code: ErrorCode
  message: string
  retryAfterSeconds?: number
  fieldErrors?: Record<string, string>
}

export type Result<T> =
  | {
      ok: true
      data: T
      requestId: string
    }
  | {
      ok: false
      error: ErrorDetail
      requestId: string
    }

export function successResult<T>(data: T, requestId?: string): Result<T> {
  return {
    ok: true,
    data,
    requestId:
      requestId ??
      (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'req_local'),
  }
}

export function errorResult(
  code: ErrorCode,
  message: string,
  options?: {
    requestId?: string
    retryAfterSeconds?: number
    fieldErrors?: Record<string, string>
  },
): Result<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      retryAfterSeconds: options?.retryAfterSeconds,
      fieldErrors: options?.fieldErrors,
    },
    requestId:
      options?.requestId ??
      (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'req_local'),
  }
}

export const HTTP_STATUS_MAP: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  AUTH_REQUIRED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  FEATURE_DISABLED: 503,
  RATE_LIMITED: 429,
  BUDGET_EXHAUSTED: 429,
  CONFIG_UNAVAILABLE: 503,
  PROVIDER_UNAVAILABLE: 503,
  DATABASE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
}
