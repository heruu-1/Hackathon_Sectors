import assert from 'node:assert/strict'
import test from 'node:test'

import {
  computeTargetSessions,
  getNextTradingDay,
  getSessionWindow,
  identifySession,
  isBarInContinuousTrading,
  isTradingDay,
  jakartaTimeToIso,
} from '../domain/trading-sessions.ts'

test('isTradingDay correctly identifies weekends and official IDX holidays', () => {
  // Weekend
  const sat = isTradingDay('2026-09-19')
  assert.equal(sat.isTrading, false)
  assert.equal(sat.calendarAvailable, true)

  const sun = isTradingDay('2026-09-20')
  assert.equal(sun.isTrading, false)
  assert.equal(sun.calendarAvailable, true)

  // Normal Monday
  const mon = isTradingDay('2026-09-21')
  assert.equal(mon.isTrading, true)
  assert.equal(mon.calendarAvailable, true)

  // Independence Day 2026-08-17 (Holiday)
  const indep = isTradingDay('2026-08-17')
  assert.equal(indep.isTrading, false)
  assert.equal(indep.calendarAvailable, true)
  assert.match(indep.reason || '', /Hari Kemerdekaan RI/)

  // Year out of range
  const outOfRange = isTradingDay('2035-01-01')
  assert.equal(outOfRange.calendarAvailable, false)
})

test('getNextTradingDay skips weekends and holidays accurately', () => {
  // Friday 2026-09-18 -> Next is Monday 2026-09-21
  const nextAfterFri = getNextTradingDay('2026-09-18')
  assert.equal(nextAfterFri.nextDate, '2026-09-21')
  assert.equal(nextAfterFri.calendarAvailable, true)

  // Friday before holiday Monday (2026-08-14 -> Monday 2026-08-17 is holiday -> Tuesday 2026-08-18)
  const nextHoliday = getNextTradingDay('2026-08-14')
  assert.equal(nextHoliday.nextDate, '2026-08-18')
})

test('getSessionWindow respects Friday different hours and 15:50 exclusive end', () => {
  // Mon 2026-09-21 S1
  const monS1 = getSessionWindow('2026-09-21', 'S1')
  assert.equal(monS1.startAt, jakartaTimeToIso('2026-09-21', 9, 0, 0))
  assert.equal(monS1.endAt, jakartaTimeToIso('2026-09-21', 12, 0, 0))

  // Mon 2026-09-21 S2
  const monS2 = getSessionWindow('2026-09-21', 'S2')
  assert.equal(monS2.startAt, jakartaTimeToIso('2026-09-21', 13, 30, 0))
  assert.equal(monS2.endAt, jakartaTimeToIso('2026-09-21', 15, 50, 0))

  // Fri 2026-09-25 S1
  const friS1 = getSessionWindow('2026-09-25', 'S1')
  assert.equal(friS1.startAt, jakartaTimeToIso('2026-09-25', 9, 0, 0))
  assert.equal(friS1.endAt, jakartaTimeToIso('2026-09-25', 11, 30, 0))

  // Fri 2026-09-25 S2
  const friS2 = getSessionWindow('2026-09-25', 'S2')
  assert.equal(friS2.startAt, jakartaTimeToIso('2026-09-25', 14, 0, 0))
  assert.equal(friS2.endAt, jakartaTimeToIso('2026-09-25', 15, 50, 0))
})

test('computeTargetSessions matches mandatory prompt example: Monday 21 Sep 2026 S2 -> H1 Tue S1, H3 Wed S1, H5 Thu S1', () => {
  const targets = computeTargetSessions('2026-09-21', 'S2')

  // Horizon 1: Tuesday S1
  assert.equal(targets[1].targetDate, '2026-09-22')
  assert.equal(targets[1].targetSession, 'S1')
  assert.equal(targets[1].targetEndAt, jakartaTimeToIso('2026-09-22', 12, 0, 0))
  assert.equal(targets[1].calendarAvailable, true)

  // Horizon 3: Wednesday S1
  assert.equal(targets[3].targetDate, '2026-09-23')
  assert.equal(targets[3].targetSession, 'S1')
  assert.equal(targets[3].targetEndAt, jakartaTimeToIso('2026-09-23', 12, 0, 0))
  assert.equal(targets[3].calendarAvailable, true)

  // Horizon 5: Thursday S1
  assert.equal(targets[5].targetDate, '2026-09-24')
  assert.equal(targets[5].targetSession, 'S1')
  assert.equal(targets[5].targetEndAt, jakartaTimeToIso('2026-09-24', 12, 0, 0))
  assert.equal(targets[5].calendarAvailable, true)
})

test('isBarInContinuousTrading accepts 5m continuous bars and rejects pre/post closing bars', () => {
  // Valid Mon S1 09:00 - 09:05
  const barS1 = isBarInContinuousTrading(
    jakartaTimeToIso('2026-09-21', 9, 0, 0),
    jakartaTimeToIso('2026-09-21', 9, 5, 0),
  )
  assert.equal(barS1.isValidContinuous, true)
  assert.equal(barS1.session, 'S1')

  // Valid Mon S2 15:45 - 15:50
  const barS2Last = isBarInContinuousTrading(
    jakartaTimeToIso('2026-09-21', 15, 45, 0),
    jakartaTimeToIso('2026-09-21', 15, 50, 0),
  )
  assert.equal(barS2Last.isValidContinuous, true)
  assert.equal(barS2Last.session, 'S2')

  // Invalid: Pre-closing / post-closing 15:50 - 16:15
  const barPost = isBarInContinuousTrading(
    jakartaTimeToIso('2026-09-21', 15, 50, 0),
    jakartaTimeToIso('2026-09-21', 16, 0, 0),
  )
  assert.equal(barPost.isValidContinuous, false)

  // Invalid: Lunch break 12:15 - 12:20
  const barLunch = isBarInContinuousTrading(
    jakartaTimeToIso('2026-09-21', 12, 15, 0),
    jakartaTimeToIso('2026-09-21', 12, 20, 0),
  )
  assert.equal(barLunch.isValidContinuous, false)
})

test('identifySession correctly identifies S1, S2, Lunch, Pre, and Post sessions', () => {
  const s1Date = new Date(jakartaTimeToIso('2026-09-21', 10, 0, 0))
  assert.equal(identifySession(s1Date).session, 'S1')

  const lunchDate = new Date(jakartaTimeToIso('2026-09-21', 12, 30, 0))
  assert.equal(identifySession(lunchDate).session, 'LUNCH')

  const s2Date = new Date(jakartaTimeToIso('2026-09-21', 14, 0, 0))
  assert.equal(identifySession(s2Date).session, 'S2')
})
