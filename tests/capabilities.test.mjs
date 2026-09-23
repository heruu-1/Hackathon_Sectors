import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BrokerSummaryItemSchema,
  DailyPriceRowSchema,
  QuarterlyFinancialItemSchema,
  calculateCapabilityCost,
  getCapability,
} from '../lib/server/providers/capabilities.ts'

test('getCapability returns capability for valid id', () => {
  const cap = getCapability('companies_screener')
  assert.ok(cap)
  assert.equal(cap.accessStatus, 'AVAILABLE')
  assert.equal(cap.costRule.type, 'FIXED')
})

test('calculateCapabilityCost calculates fixed, per-quarter, and per-section costs correctly', () => {
  assert.equal(calculateCapabilityCost('daily_price'), 1)
  assert.equal(calculateCapabilityCost('financials_quarterly', { quarters: 5 }), 5)
  assert.equal(calculateCapabilityCost('financials_quarterly', { quarters: 2 }), 2)
  assert.equal(
    calculateCapabilityCost('company_report', { sections: ['valuation', 'segments'] }),
    2,
  )
  assert.equal(calculateCapabilityCost('company_report', { sections: 'valuation,financials' }), 2)
})

test('DailyPriceRowSchema validates correct price rows and rejects invalid ones', () => {
  const valid = {
    symbol: 'BBCA',
    date: '2026-09-22',
    close: 10500,
    volume: 50000000,
  }
  assert.doesNotThrow(() => DailyPriceRowSchema.parse(valid))

  const invalidDate = {
    symbol: 'BBCA',
    date: '22-09-2026', // wrong format
    close: 10500,
    volume: 50000000,
  }
  assert.throws(() => DailyPriceRowSchema.parse(invalidDate))
})

test('BrokerSummaryItemSchema validates broker summary row', () => {
  const valid = {
    broker_code: 'YP',
    buy_volume: 1000,
    buy_value: 5000000,
    sell_volume: 500,
    sell_value: 2500000,
    is_foreign: false,
  }
  const parsed = BrokerSummaryItemSchema.parse(valid)
  assert.equal(parsed.broker_code, 'YP')
  assert.equal(parsed.buy_volume, 1000)
})

test('QuarterlyFinancialItemSchema parses valid quarterly items', () => {
  const valid = {
    quarter: '2024-Q3',
    revenue: 1000000000,
    net_income: 200000000,
  }
  const parsed = QuarterlyFinancialItemSchema.parse(valid)
  assert.equal(parsed.quarter, '2024-Q3')
  assert.equal(parsed.revenue, 1000000000)
})
