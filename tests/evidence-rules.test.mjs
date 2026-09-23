import assert from 'node:assert/strict'
import test from 'node:test'

import {
  evaluateAllEvidenceRules,
  evaluateR01,
  evaluateR02,
  evaluateR03,
  evaluateR04,
  evaluateR05,
  evaluateR06,
  evaluateR07,
  evaluateR09,
  evaluateR10,
} from '../domain/evidence-rules.ts'

test('R01 detects price vs foreign flow divergence accurately', () => {
  // Price up + Foreign sell -> Divergent
  const res1 = evaluateR01({ priceReturn5Sessions: 0.05, netForeignFlow5Sessions: -5000000000 })
  assert.equal(res1.status, 'EVALUATED_TRUE')
  assert.equal(res1.evidenceDirection, 'CONFLICTING')

  // Price up + Foreign buy -> Aligned
  const res2 = evaluateR01({ priceReturn5Sessions: 0.05, netForeignFlow5Sessions: 5000000000 })
  assert.equal(res2.status, 'EVALUATED_FALSE')
  assert.equal(res2.evidenceDirection, 'ALIGNED')

  // Missing data -> NOT_EVALUABLE
  const res3 = evaluateR01({ priceReturn5Sessions: null, netForeignFlow5Sessions: 5000000000 })
  assert.equal(res3.status, 'NOT_EVALUABLE')
})

test('R02 evaluates news vs foreign flow divergence', () => {
  const res1 = evaluateR02({ newsDirection: 'BULLISH', foreignFlowDirection: 'DISTRIBUTION' })
  assert.equal(res1.status, 'EVALUATED_TRUE')
  assert.equal(res1.evidenceDirection, 'CONFLICTING')

  const res2 = evaluateR02({ newsDirection: 'NEUTRAL', foreignFlowDirection: 'ACCUMULATION' })
  assert.equal(res2.status, 'NOT_EVALUABLE')
})

test('R03 evaluates news vs post-event return divergence', () => {
  // Bullish news but price dropped on session 1
  const res = evaluateR03({ newsDirection: 'BULLISH', postNews1SessionReturn: -0.03 })
  assert.equal(res.status, 'EVALUATED_TRUE')
  assert.equal(res.evidenceDirection, 'CONFLICTING')
})

test('R04 evaluates relative volume spike threshold >= 2.0x', () => {
  assert.equal(evaluateR04({ relativeVolume20: 2.5 }).status, 'EVALUATED_TRUE')
  assert.equal(evaluateR04({ relativeVolume20: 1.8 }).status, 'EVALUATED_FALSE')
  assert.equal(evaluateR04({ relativeVolume20: null }).status, 'NOT_EVALUABLE')
})

test('R05 evaluates consistent fundamental growth vs lagging price', () => {
  // Revenue and net income up >= 15%, but return vs IHSG is negative (-5%)
  const res1 = evaluateR05({
    revenueGrowthYoY: 0.2,
    netIncomeGrowthYoY: 0.25,
    relativeReturn20VsIhsg: -0.05,
  })
  assert.equal(res1.status, 'EVALUATED_TRUE')
  assert.equal(res1.evidenceDirection, 'CONFLICTING')

  // Price not lagging (+10% vs IHSG) -> EVALUATED_FALSE
  const res2 = evaluateR05({
    revenueGrowthYoY: 0.2,
    netIncomeGrowthYoY: 0.25,
    relativeReturn20VsIhsg: 0.1,
  })
  assert.equal(res2.status, 'EVALUATED_FALSE')
})

test('R06 evaluates cheap valuation with deteriorating earnings', () => {
  // Discount valuation with negative net income growth (-10%)
  const res1 = evaluateR06({
    peStatus: 'DISCOUNT',
    netIncomeGrowthYoY: -0.1,
  })
  assert.equal(res1.status, 'EVALUATED_TRUE')
  assert.equal(res1.evidenceDirection, 'CONFLICTING')

  // Discount valuation with positive growth (+15%) -> not a value trap
  const res2 = evaluateR06({
    peStatus: 'DISCOUNT',
    netIncomeGrowthYoY: 0.15,
  })
  assert.equal(res2.status, 'EVALUATED_FALSE')
})

test('R07 evaluates positive net income with negative operating cash flow', () => {
  // Non-financial company with net income > 0 and OCF < 0
  const res1 = evaluateR07({
    netIncome: 1000000000,
    operatingCashFlow: -200000000,
    isFinancialSector: false,
  })
  assert.equal(res1.status, 'EVALUATED_TRUE')
  assert.equal(res1.evidenceDirection, 'CONFLICTING')

  // Financial sector company -> excluded from OCF divergence check
  const res2 = evaluateR07({
    netIncome: 1000000000,
    operatingCashFlow: -200000000,
    isFinancialSector: true,
  })
  assert.equal(res2.status, 'EVALUATED_FALSE')
  assert.equal(res2.evidenceDirection, 'NEUTRAL')
})

test('R09 evaluates upcoming corporate action within 30 days', () => {
  assert.equal(evaluateR09({ upcomingCorporateActionsDays: 14 }).status, 'EVALUATED_TRUE')
  assert.equal(evaluateR09({ upcomingCorporateActionsDays: 45 }).status, 'EVALUATED_FALSE')
  assert.equal(evaluateR09({ upcomingCorporateActionsDays: null }).status, 'NOT_EVALUABLE')
})

test('R10 flags price comparison suspension on corporate action', () => {
  assert.equal(evaluateR10({ hasCorporateActionInPriceWindow: true }).status, 'EVALUATED_TRUE')
  assert.equal(evaluateR10({ hasCorporateActionInPriceWindow: false }).status, 'EVALUATED_FALSE')
  assert.equal(evaluateR10({ hasCorporateActionInPriceWindow: null }).status, 'NOT_EVALUABLE')
})

test('evaluateAllEvidenceRules runs all rules and returns array of 10 rules', () => {
  const all = evaluateAllEvidenceRules({
    priceReturn5Sessions: 0.05,
    netForeignFlow5Sessions: -1000,
    relativeVolume20: 2.1,
  })
  assert.equal(all.length, 10)
})
