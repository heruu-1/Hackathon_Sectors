import assert from 'node:assert/strict'
import test from 'node:test'

import {
  analyzeFundamentals,
  calculateGrowth,
  classifyBusinessGroup,
} from '../domain/fundamentals.ts'

test('classifyBusinessGroup identifies bank, insurance, and non-financial', () => {
  assert.equal(classifyBusinessGroup('Financials', 'Banks'), 'BANK')
  assert.equal(classifyBusinessGroup('Keuangan', 'Bank'), 'BANK')
  assert.equal(classifyBusinessGroup('Financials', 'Insurance'), 'INSURANCE')
  assert.equal(classifyBusinessGroup('Consumer Cyclical', 'Retail'), 'NON_FINANCIAL')
  assert.equal(classifyBusinessGroup('Energy', 'Oil & Gas'), 'NON_FINANCIAL')
  assert.equal(classifyBusinessGroup(undefined, undefined), 'NON_FINANCIAL')
})

test('calculateGrowth handles various transitions correctly', () => {
  // Positive baseline
  const g1 = calculateGrowth(120, 100)
  assert.equal(g1.growthFraction, 0.2)
  assert.equal(g1.growthLabel, '+20.00%')
  assert.equal(g1.nominalDiff, 20)

  // Negative baseline to positive -> Berbalik Laba
  const g2 = calculateGrowth(50, -20)
  assert.equal(g2.growthFraction, null)
  assert.equal(g2.growthLabel, 'Berbalik Laba')

  // Positive baseline to negative -> Berbalik Rugi
  const g3 = calculateGrowth(-30, 40)
  assert.equal(g3.growthFraction, null)
  assert.equal(g3.growthLabel, 'Berbalik Rugi')

  // Continuing loss: Rugi Bertambah vs Rugi Berkurang
  const g4 = calculateGrowth(-60, -30)
  assert.equal(g4.growthLabel, 'Rugi Bertambah')

  const g5 = calculateGrowth(-15, -30)
  assert.equal(g5.growthLabel, 'Rugi Berkurang')

  // Missing data
  const g6 = calculateGrowth(null, 100)
  assert.equal(g6.growthLabel, 'Data tidak lengkap')
})

test('analyzeFundamentals evaluates non-financial company and R07 divergence', () => {
  const quarters = [
    {
      quarter: '2024-Q3',
      revenue: 1500,
      net_income: 150,
      operating_profit: 200,
      operating_cash_flow: -50, // Divergent: Net income > 0 but OCF < 0
      total_assets: 5000,
      total_liabilities: 2000,
      total_equity: 3000,
    },
    { quarter: '2024-Q2' },
    { quarter: '2024-Q1' },
    { quarter: '2023-Q4' },
    {
      quarter: '2023-Q3',
      revenue: 1200,
      net_income: 100,
      operating_profit: 150,
      operating_cash_flow: 80,
      total_assets: 4500,
      total_liabilities: 1800,
      total_equity: 2700,
    },
  ]

  const result = analyzeFundamentals(quarters, 'Consumer Non-Cyclical', 'Food & Beverage')
  assert.ok(result)
  assert.equal(result.group, 'NON_FINANCIAL')
  assert.equal(result.quarter, '2024-Q3')
  assert.equal(result.revenueGrowth.growthLabel, '+25.00%')
  assert.equal(result.netIncomeGrowth.growthLabel, '+50.00%')
  // Net margin current: 150 / 1500 = 0.10 (10%)
  // Net margin previous: 100 / 1200 = 0.0833 (8.33%)
  // Margin change: ~1.67 points
  assert.equal(result.netMarginCurrent, 0.1)
  assert.equal(result.marginChangePoints, 1.67)
  assert.equal(result.isCashFlowDivergent, true) // R07 triggered
  assert.equal(result.debtToEquity, 0.67) // 2000 / 3000 = 0.67
})

test('analyzeFundamentals evaluates bank-specific metrics and LDR', () => {
  const quarters = [
    {
      quarter: '2024-Q3',
      net_interest_income: 12000,
      net_income: 8000,
      loans: 90000,
      deposits: 100000,
    },
    { quarter: '2024-Q2' },
    { quarter: '2024-Q1' },
    { quarter: '2023-Q4' },
    {
      quarter: '2023-Q3',
      net_interest_income: 10000,
      net_income: 7000,
      loans: 80000,
      deposits: 95000,
    },
  ]

  const result = analyzeFundamentals(quarters, 'Financials', 'Banks')
  assert.ok(result)
  assert.equal(result.group, 'BANK')
  assert.equal(result.quarter, '2024-Q3')
  assert.equal(result.netInterestIncomeGrowth.growthLabel, '+20.00%')
  assert.equal(result.netIncomeGrowth.growthLabel, '+14.29%')
  assert.equal(result.loanGrowth?.growthLabel, '+12.50%')
  assert.equal(result.depositGrowth?.growthLabel, '+5.26%')
  assert.equal(result.loanToDepositRatio, 0.9) // 90,000 / 100,000
})
