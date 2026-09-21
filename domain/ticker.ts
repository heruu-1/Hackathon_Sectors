export class TickerValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TickerValidationError'
  }
}

/**
 * Normalizes IDX stock tickers.
 * Accepts lowercase, uppercase, whitespace, and optional .JK suffix.
 * Returns 4-letter uppercase ticker (e.g. "BBCA").
 * Rejects invalid length, characters, or non-IDX symbols.
 */
export function normalizeTicker(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TickerValidationError(
      'Kode saham harus berupa teks 4 huruf, contoh: BBCA atau BBCA.JK',
    )
  }
  const trimmed = value.trim().toUpperCase()
  const clean = trimmed.replace(/\.JK$/i, '')
  if (!/^[A-Z]{4}$/.test(clean)) {
    throw new TickerValidationError(
      'Kode saham IDX harus terdiri dari 4 huruf kapital, contoh: BBCA atau BBCA.JK',
    )
  }
  return clean
}

export function isValidTicker(value: unknown): boolean {
  try {
    normalizeTicker(value)
    return true
  } catch {
    return false
  }
}
