import type { Horizon, SessionId } from '../lib/contracts/signal-analysis.ts'
import idxCalendar from '../lib/data/idx-calendar-2026.json' with { type: 'json' }

export interface SessionWindow {
  dateStr: string
  session: SessionId
  startAt: string // ISO string in UTC or +07:00
  endAt: string // ISO string in UTC or +07:00
}

export interface TargetSessionInfo {
  horizon: Horizon
  targetDate: string
  targetSession: SessionId
  targetEndAt: string
  calendarAvailable: boolean
}

const HOLIDAY_SET = new Set(idxCalendar.holidays.map((h) => h.date))
const COVERED_YEARS = new Set(idxCalendar.years)

/**
 * Returns date components in Asia/Jakarta (WIB, UTC+7).
 */
export function getJakartaDateParts(d: Date): {
  year: number
  month: number
  day: number
  dayOfWeek: number // 0 = Sun, 1 = Mon, ..., 6 = Sat
  hour: number
  minute: number
  second: number
  dateStr: string
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(d)
  const map: Record<string, string> = {}
  for (const p of parts) {
    map[p.type] = p.value
  }

  const year = Number(map.year)
  const month = Number(map.month)
  const day = Number(map.day)
  const hour = Number(map.hour)
  const minute = Number(map.minute)
  const second = Number(map.second)
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  // Day of week calculation in Jakarta
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay()

  return { year, month, day, dayOfWeek, hour, minute, second, dateStr }
}

/**
 * Converts a Jakarta (dateStr, hour, minute, second) to UTC ISO string.
 */
export function jakartaTimeToIso(
  dateStr: string,
  hour: number,
  minute: number,
  second = 0,
): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  // Jakarta is UTC+7, so UTC hour = hour - 7
  const utcMs = Date.UTC(y, m - 1, d, hour - 7, minute, second)
  return new Date(utcMs).toISOString()
}

/**
 * Checks whether a given YYYY-MM-DD date is a valid BEI trading day.
 */
export function isTradingDay(dateStr: string): {
  isTrading: boolean
  calendarAvailable: boolean
  reason?: string
} {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!COVERED_YEARS.has(y)) {
    return {
      isTrading: false,
      calendarAvailable: false,
      reason: `Tahun ${y} di luar cakupan kalender resmi (2024-2026).`,
    }
  }

  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      isTrading: false,
      calendarAvailable: true,
      reason: dayOfWeek === 0 ? 'Hari Minggu (Bursa Libur)' : 'Hari Sabtu (Bursa Libur)',
    }
  }

  if (HOLIDAY_SET.has(dateStr)) {
    const hol = idxCalendar.holidays.find((h) => h.date === dateStr)
    return {
      isTrading: false,
      calendarAvailable: true,
      reason: hol ? `Hari Libur Bursa: ${hol.name}` : 'Hari Libur Bursa',
    }
  }

  return { isTrading: true, calendarAvailable: true }
}

/**
 * Gets the next trading day strictly after dateStr.
 */
export function getNextTradingDay(dateStr: string): {
  nextDate: string | null
  calendarAvailable: boolean
} {
  const [y, m, d] = dateStr.split('-').map(Number)
  let cur = new Date(Date.UTC(y, m - 1, d))

  // Scan up to 30 days ahead
  for (let i = 0; i < 30; i++) {
    cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000)
    const nextY = cur.getUTCFullYear()
    const nextM = cur.getUTCMonth() + 1
    const nextD = cur.getUTCDate()
    const nextStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(nextD).padStart(2, '0')}`

    const check = isTradingDay(nextStr)
    if (!check.calendarAvailable) {
      return { nextDate: null, calendarAvailable: false }
    }
    if (check.isTrading) {
      return { nextDate: nextStr, calendarAvailable: true }
    }
  }

  return { nextDate: null, calendarAvailable: false }
}

/**
 * Gets session start and end times for a specific trading date.
 * Times are continuous trading bounds:
 * Mon-Thu: S1 09:00:00 - 12:00:00, S2 13:30:00 - 15:50:00
 * Fri:     S1 09:00:00 - 11:30:00, S2 14:00:00 - 15:50:00
 */
export function getSessionWindow(dateStr: string, session: SessionId): SessionWindow {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const isFriday = dayOfWeek === 5

  if (session === 'S1') {
    const startAt = jakartaTimeToIso(dateStr, 9, 0, 0)
    const endAt = isFriday
      ? jakartaTimeToIso(dateStr, 11, 30, 0)
      : jakartaTimeToIso(dateStr, 12, 0, 0)
    return { dateStr, session, startAt, endAt }
  } else {
    const startAt = isFriday
      ? jakartaTimeToIso(dateStr, 14, 0, 0)
      : jakartaTimeToIso(dateStr, 13, 30, 0)
    const endAt = jakartaTimeToIso(dateStr, 15, 50, 0) // Exclusive bound at 15:50:00
    return { dateStr, session, startAt, endAt }
  }
}

/**
 * Identifies which session a given timestamp falls into (or whether outside continuous trading).
 */
export function identifySession(d: Date): {
  dateStr: string
  session: SessionId | 'PRE' | 'LUNCH' | 'POST' | 'CLOSED'
  isContinuousTrading: boolean
} {
  const { dateStr, dayOfWeek, hour, minute, second } = getJakartaDateParts(d)
  const isFriday = dayOfWeek === 5
  const timeInMinutes = hour * 60 + minute + second / 60

  const s1Start = 9 * 60 // 09:00
  const s1End = isFriday ? 11 * 60 + 30 : 12 * 60 // 11:30 Fri, 12:00 Mon-Thu
  const s2Start = isFriday ? 14 * 60 : 13 * 60 + 30 // 14:00 Fri, 13:30 Mon-Thu
  const s2End = 15 * 60 + 50 // 15:50 exclusive

  if (timeInMinutes >= s1Start && timeInMinutes < s1End) {
    return { dateStr, session: 'S1', isContinuousTrading: true }
  }

  if (timeInMinutes >= s2Start && timeInMinutes < s2End) {
    return { dateStr, session: 'S2', isContinuousTrading: true }
  }

  if (timeInMinutes >= s1End && timeInMinutes < s2Start) {
    return { dateStr, session: 'LUNCH', isContinuousTrading: false }
  }

  if (timeInMinutes >= 8 * 60 + 45 && timeInMinutes < s1Start) {
    return { dateStr, session: 'PRE', isContinuousTrading: false }
  }

  if (timeInMinutes >= s2End && timeInMinutes <= 16 * 60 + 15) {
    return { dateStr, session: 'POST', isContinuousTrading: false }
  }

  return { dateStr, session: 'CLOSED', isContinuousTrading: false }
}

/**
 * Computes target session horizons (1, 3, 5) from a signal session.
 * Horizon 1 is the completion of the NEXT trading session.
 * For example:
 * Signal at Monday S2 ->
 * Horizon 1: Tuesday S1
 * Horizon 2: Tuesday S2
 * Horizon 3: Wednesday S1
 * Horizon 4: Wednesday S2
 * Horizon 5: Thursday S1
 */
export function computeTargetSessions(
  signalDateStr: string,
  signalSession: SessionId,
): Record<Horizon, TargetSessionInfo> {
  const sequence: Array<{ dateStr: string; session: SessionId }> = []
  let curDate = signalDateStr
  let curSession = signalSession
  let calendarOk = true

  // Generate 5 forward sessions
  for (let step = 1; step <= 5; step++) {
    if (curSession === 'S1') {
      // Next session is S2 on the SAME day
      curSession = 'S2'
      sequence.push({ dateStr: curDate, session: curSession })
    } else {
      // Current is S2, next session is S1 on the NEXT trading day
      const nextDayRes = getNextTradingDay(curDate)
      if (!nextDayRes.calendarAvailable || !nextDayRes.nextDate) {
        calendarOk = false
        break
      }
      curDate = nextDayRes.nextDate
      curSession = 'S1'
      sequence.push({ dateStr: curDate, session: curSession })
    }
  }

  const buildHorizon = (h: Horizon): TargetSessionInfo => {
    const item = sequence[h - 1]
    if (!item || !calendarOk) {
      return {
        horizon: h,
        targetDate: '',
        targetSession: 'S1',
        targetEndAt: '',
        calendarAvailable: false,
      }
    }
    const win = getSessionWindow(item.dateStr, item.session)
    return {
      horizon: h,
      targetDate: item.dateStr,
      targetSession: item.session,
      targetEndAt: win.endAt,
      calendarAvailable: true,
    }
  }

  return {
    1: buildHorizon(1),
    3: buildHorizon(3),
    5: buildHorizon(5),
  }
}

/**
 * Validates if an intraday bar (startAt, endAt) belongs to a continuous trading session.
 * Bars must be strictly within S1 or S2 continuous trading hours.
 */
export function isBarInContinuousTrading(
  startAtIso: string,
  endAtIso: string,
): {
  isValidContinuous: boolean
  session?: SessionId
  dateStr?: string
} {
  const startD = new Date(startAtIso)
  const endD = new Date(endAtIso)

  const startPart = getJakartaDateParts(startD)
  const endPart = getJakartaDateParts(endD)

  // Must be same day in Jakarta
  if (startPart.dateStr !== endPart.dateStr) {
    return { isValidContinuous: false }
  }

  const dayCheck = isTradingDay(startPart.dateStr)
  if (!dayCheck.isTrading) {
    return { isValidContinuous: false }
  }

  const isFriday = startPart.dayOfWeek === 5
  const startMin = startPart.hour * 60 + startPart.minute
  const endMin = endPart.hour * 60 + endPart.minute

  // S1 window: 09:00 to 12:00 (Mon-Thu) or 11:30 (Fri)
  const s1EndMin = isFriday ? 11 * 60 + 30 : 12 * 60
  if (startMin >= 9 * 60 && endMin <= s1EndMin) {
    return {
      isValidContinuous: true,
      session: 'S1',
      dateStr: startPart.dateStr,
    }
  }

  // S2 window: 13:30 (Mon-Thu) or 14:00 (Fri) to 15:50 (Exclusive bound)
  const s2StartMin = isFriday ? 14 * 60 : 13 * 60 + 30
  const s2EndMin = 15 * 60 + 50 // 15:50 sharp
  if (startMin >= s2StartMin && endMin <= s2EndMin) {
    return {
      isValidContinuous: true,
      session: 'S2',
      dateStr: startPart.dateStr,
    }
  }

  return { isValidContinuous: false }
}
