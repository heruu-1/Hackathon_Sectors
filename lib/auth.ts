import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

import { db } from '@/db'
import { account, session, user, verification } from '@/db/schema'

const isProduction = process.env.NODE_ENV === 'production'
const authSecret = process.env.BETTER_AUTH_SECRET?.trim()
const authUrl = process.env.BETTER_AUTH_URL?.trim() || 'http://localhost:3000'
const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim()
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()

/**
 * Validates that the authentication secret is safe for production runtime.
 * Production strictly forbids placeholders, development secrets, and strings < 32 characters.
 */
export function isAuthSecretValid(): boolean {
  if (!isProduction) return true
  if (
    !authSecret ||
    authSecret.includes('change-this') ||
    authSecret.includes('placeholder') ||
    authSecret.length < 32 ||
    !authUrl.startsWith('https://')
  ) {
    return false
  }
  return true
}

const trustedOrigins = (() => {
  try {
    const list = [new URL(authUrl).origin]
    if (!isProduction) {
      list.push('http://localhost:3000', 'http://127.0.0.1:3000')
    }
    return Array.from(new Set(list))
  } catch {
    return isProduction ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000']
  }
})()

/**
 * Server-only Better Auth configuration.
 * Safe for build time; runtime blocks requests if production secret is not configured.
 */
export const auth = betterAuth({
  baseURL: authUrl,
  trustedOrigins,
  secret: authSecret || 'rasi-development-secret-change-this-before-deployment-32-chars',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification },
  }),
  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : undefined,
  advanced: {
    useSecureCookies: isProduction,
    cookiePrefix: 'rasi',
    defaultCookieAttributes: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
    },
  },
})
