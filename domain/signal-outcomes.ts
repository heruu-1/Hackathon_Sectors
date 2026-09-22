/**
 * Domain module for evaluating signal outcomes across 1, 3, and 5 trading sessions (E01).
 * Calculates forward returns from the signal date based on chronological daily price series.
 */

export type SignalOutcomeStatus =
  'PENDING' | 'MATURED' | 'MISSING_PRICE' | 'CORPORATE_ACTION_SUSPENDED'

export interface SignalOutcomeEvaluation {
  snapshotId: string
  ruleId: string
  ruleVersion: string
  ticker: string
  horizon: 1 | 3 | 5
  signalDate: string
  targetDate: string | null
  initialPrice: number | null
  targetPrice: number | null
  returnFraction: number | null
  status: SignalOutcomeStatus
}

/**
 * Evaluates 1, 3, and 5 session outcomes from a signal date against a chronological daily price series.
 * @param dailyPrices Price history sorted by date ascending (oldest first).
 */
export function evaluateSignalOutcomes(
  snapshotId: string,
  ticker: string,
  ruleId: string,
  ruleVersion: string,
  signalDate: string,
  initialPrice: number | null,
  dailyPrices: Array<{ date: string; close: number }>,
): SignalOutcomeEvaluation[] {
  const horizons: Array<1 | 3 | 5> = [1, 3, 5]

  // Find index of signal date in the daily series
  const signalIndex = dailyPrices.findIndex((p) => p.date === signalDate)

  return horizons.map((horizon) => {
    // If signal date not found in history
    if (signalIndex === -1) {
      return {
        snapshotId,
        ruleId,
        ruleVersion,
        ticker,
        horizon,
        signalDate,
        targetDate: null,
        initialPrice,
        targetPrice: null,
        returnFraction: null,
        status: 'MISSING_PRICE',
      }
    }

    const basePrice = initialPrice ?? dailyPrices[signalIndex].close
    if (!basePrice || basePrice <= 0) {
      return {
        snapshotId,
        ruleId,
        ruleVersion,
        ticker,
        horizon,
        signalDate,
        targetDate: null,
        initialPrice: null,
        targetPrice: null,
        returnFraction: null,
        status: 'MISSING_PRICE',
      }
    }

    const targetIndex = signalIndex + horizon

    // If target session has not yet occurred
    if (targetIndex >= dailyPrices.length) {
      return {
        snapshotId,
        ruleId,
        ruleVersion,
        ticker,
        horizon,
        signalDate,
        targetDate: null,
        initialPrice: basePrice,
        targetPrice: null,
        returnFraction: null,
        status: 'PENDING',
      }
    }

    // Target session is reached
    const targetSession = dailyPrices[targetIndex]
    const targetPrice = targetSession.close
    const returnFraction = Number(((targetPrice - basePrice) / basePrice).toFixed(4))

    return {
      snapshotId,
      ruleId,
      ruleVersion,
      ticker,
      horizon,
      signalDate,
      targetDate: targetSession.date,
      initialPrice: basePrice,
      targetPrice,
      returnFraction,
      status: 'MATURED',
    }
  })
}
