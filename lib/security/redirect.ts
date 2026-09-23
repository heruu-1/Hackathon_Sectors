/**
 * Sanitizes and validates a redirect callback URL to prevent Open Redirect attacks.
 * Strictly permits only relative paths (e.g. /saham/BBCA, /watchlist) and rejects:
 * - External schemes (http:, https:, javascript:, data:, vbscript:)
 * - Protocol-relative URLs (//evil.com)
 * - Backslash evasion (\evil.com, /\evil.com)
 * - Encoded evasion (%2f%2fevil.com, %5c)
 * - Control characters
 */
export function sanitizeCallbackUrl(rawUrl: string | null | undefined, fallback = '/'): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return fallback
  }

  const trimmed = rawUrl.trim()
  if (!trimmed) {
    return fallback
  }

  // Reject control characters and newlines
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return fallback
  }

  // Reject backslashes anywhere before path query/hash or immediately at start
  if (trimmed.startsWith('\\') || trimmed.includes('\\')) {
    return fallback
  }

  // Reject protocol-relative URLs (e.g. //evil.com or ///evil.com)
  if (trimmed.startsWith('//')) {
    return fallback
  }

  // Reject URL schemes (e.g. https://, http://, javascript:, data:)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return fallback
  }

  // Check URL-decoded version to catch encoded bypasses (e.g. %2f%2fevil.com or %5cevil.com)
  try {
    const decoded = decodeURIComponent(trimmed)
    if (
      decoded.startsWith('//') ||
      decoded.startsWith('\\') ||
      decoded.includes('\\') ||
      /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(decoded) ||
      /[\x00-\x1F\x7F]/.test(decoded)
    ) {
      return fallback
    }
  } catch {
    // Malformed URI encoding
    return fallback
  }

  // Must strictly start with a single '/'
  if (!trimmed.startsWith('/')) {
    return fallback
  }

  // If path is just '/', return it
  if (trimmed === '/') {
    return '/'
  }

  // Ensure character after '/' is alphanumeric or allowed relative path character
  // Reject '/\\' or '//'
  if (trimmed[1] === '/' || trimmed[1] === '\\') {
    return fallback
  }

  return trimmed
}
