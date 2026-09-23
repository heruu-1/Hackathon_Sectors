import 'server-only'

/**
 * Returns a stable default date range for broker activity exploration.
 * Encapsulates date computation outside component rendering.
 */
export function getStableBrokerDateRange(): { startDate: string; endDate: string } {
  const now = Date.now()
  const endDate = new Date(now).toISOString().split('T')[0]
  const startDate = new Date(now - 4 * 86_400_000).toISOString().split('T')[0]
  return { startDate, endDate }
}
