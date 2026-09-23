import { z } from 'zod'

const KNOWN_PLACEHOLDERS = new Set([
  'your_better_auth_secret_here',
  'rasi-development-secret-change-this-before-deployment-32-chars',
  'your_sectors_api_key_here',
  'your_gemini_api_key_here',
  'your_google_client_id_here',
  'your_google_client_secret_here',
])

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return false
  const trimmed = value.trim().toLowerCase()
  if (KNOWN_PLACEHOLDERS.has(trimmed)) return true
  if (
    trimmed.includes('change-this') ||
    trimmed.includes('your_') ||
    trimmed.includes('placeholder')
  ) {
    return true
  }
  return false
}

export const ServerEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().trim().min(1, 'DATABASE_URL wajib diisi.'),
    DATABASE_MIGRATION_URL: z.string().trim().optional(),
    TEST_DATABASE_URL: z.string().trim().optional(),
    SECTORS_API_KEY: z.string().trim().optional(),
    GEMINI_API_KEY: z.string().trim().optional(),
    GEMINI_MODEL: z.string().trim().default('gemini-3.5-flash-lite'),
    BETTER_AUTH_SECRET: z
      .string()
      .trim()
      .default('rasi-development-secret-change-this-before-deployment-32-chars'),
    BETTER_AUTH_URL: z.string().trim().default('http://localhost:3000'),
    GOOGLE_CLIENT_ID: z.string().trim().optional(),
    GOOGLE_CLIENT_SECRET: z.string().trim().optional(),
    SECTORS_DAILY_CREDIT_BUDGET: z.coerce.number().int().nonnegative().default(0),
    GEMINI_DAILY_REQUEST_BUDGET: z.coerce.number().int().nonnegative().default(0),
    RASI_ANALYSIS_ENABLED: z
      .string()
      .trim()
      .optional()
      .transform((v) => v === 'true' || v === '1'),
    RASI_ASSISTANT_ENABLED: z
      .string()
      .trim()
      .optional()
      .transform((v) => v === 'true' || v === '1'),
    SIGNAL_ANALYSIS_ENABLED: z
      .string()
      .trim()
      .optional()
      .transform((v) => v === 'true' || v === '1'),
    INTRADAY_PROVIDER: z.enum(['yahoo']).default('yahoo'),
  })
  .superRefine((data, ctx) => {
    const isProd = data.NODE_ENV === 'production'

    // 1. BETTER_AUTH_SECRET checks
    if (isPlaceholder(data.BETTER_AUTH_SECRET)) {
      if (isProd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['BETTER_AUTH_SECRET'],
          message: 'BETTER_AUTH_SECRET tidak boleh menggunakan placeholder di lingkungan produksi.',
        })
      }
    }
    if (data.BETTER_AUTH_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BETTER_AUTH_SECRET'],
        message: 'BETTER_AUTH_SECRET harus memiliki panjang minimal 32 karakter.',
      })
    }

    // 2. Production URL must be HTTPS
    if (isProd && !data.BETTER_AUTH_URL.startsWith('https://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BETTER_AUTH_URL'],
        message: 'BETTER_AUTH_URL harus menggunakan protokol HTTPS di lingkungan produksi.',
      })
    }

    // 3. Google OAuth must come in pairs
    const hasGoogleId = Boolean(data.GOOGLE_CLIENT_ID && !isPlaceholder(data.GOOGLE_CLIENT_ID))
    const hasGoogleSecret = Boolean(
      data.GOOGLE_CLIENT_SECRET && !isPlaceholder(data.GOOGLE_CLIENT_SECRET),
    )
    if (hasGoogleId !== hasGoogleSecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: hasGoogleId ? ['GOOGLE_CLIENT_SECRET'] : ['GOOGLE_CLIENT_ID'],
        message: 'GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET harus disediakan berpasangan.',
      })
    }

    // 4. If Assistant is enabled, GEMINI_API_KEY and GEMINI_MODEL must be valid
    if (data.RASI_ASSISTANT_ENABLED) {
      if (!data.GEMINI_API_KEY || isPlaceholder(data.GEMINI_API_KEY)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GEMINI_API_KEY'],
          message: 'GEMINI_API_KEY diperlukan saat RASI_ASSISTANT_ENABLED bernilai true.',
        })
      }
      if (!data.GEMINI_MODEL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GEMINI_MODEL'],
          message: 'GEMINI_MODEL wajib ditentukan secara eksplisit saat asisten diaktifkan.',
        })
      }
    }
  })

export type ServerEnv = z.infer<typeof ServerEnvSchema>

let cachedEnv: ServerEnv | null = null

export function getServerEnv(
  envSource: Record<string, string | undefined> = process.env,
): ServerEnv {
  if (cachedEnv && envSource === process.env) {
    return cachedEnv
  }
  const parsed = ServerEnvSchema.parse(envSource)
  if (envSource === process.env) {
    cachedEnv = parsed
  }
  return parsed
}

export function maskSecret(val: string | undefined): string {
  if (!val) return '[KOSONG]'
  if (isPlaceholder(val)) return '[PLACEHOLDER DITOLAK]'
  if (val.length < 8) return '[TERLALU PENDEK]'
  return `[TERISI - ${val.length} karakter]`
}

export function getSanitizedEnvSummary(env: Partial<ServerEnv> = process.env) {
  return {
    NODE_ENV: env.NODE_ENV ?? 'development',
    DATABASE_URL: env.DATABASE_URL ? '[TERISI]' : '[KOSONG]',
    DATABASE_MIGRATION_URL: env.DATABASE_MIGRATION_URL
      ? '[TERISI]'
      : '[KOSONG (fallback ke DATABASE_URL)]',
    TEST_DATABASE_URL: env.TEST_DATABASE_URL ? '[TERISI]' : '[KOSONG]',
    SECTORS_API_KEY: maskSecret(env.SECTORS_API_KEY),
    GEMINI_API_KEY: maskSecret(env.GEMINI_API_KEY),
    GEMINI_MODEL: env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite',
    BETTER_AUTH_SECRET: maskSecret(env.BETTER_AUTH_SECRET),
    BETTER_AUTH_URL: env.BETTER_AUTH_URL ?? '[KOSONG]',
    GOOGLE_CLIENT_ID: maskSecret(env.GOOGLE_CLIENT_ID),
    GOOGLE_CLIENT_SECRET: maskSecret(env.GOOGLE_CLIENT_SECRET),
    SECTORS_DAILY_CREDIT_BUDGET: env.SECTORS_DAILY_CREDIT_BUDGET ?? 0,
    GEMINI_DAILY_REQUEST_BUDGET: env.GEMINI_DAILY_REQUEST_BUDGET ?? 0,
    RASI_ANALYSIS_ENABLED: env.RASI_ANALYSIS_ENABLED ? 'true' : 'false',
    RASI_ASSISTANT_ENABLED: env.RASI_ASSISTANT_ENABLED ? 'true' : 'false',
  }
}
