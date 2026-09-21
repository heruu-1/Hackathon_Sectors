import assert from 'node:assert/strict'
import { test } from 'node:test'

import { POPULAR_STOCKS, getStockRelevanceScore, searchLocalStocks } from '../domain/stocks.ts'

test('domain/stocks: searchLocalStocks returns instant popular stocks for empty query', () => {
  const results = searchLocalStocks('', 5)
  assert.equal(results.length, 5)
  assert.equal(results[0].symbol, 'BBCA')
  assert.equal(results[1].symbol, 'BBRI')
})

test('domain/stocks: searchLocalStocks("TL") immediately returns TLKM at top', () => {
  const results = searchLocalStocks('TL', 5)
  assert.ok(results.length >= 1)
  assert.equal(results[0].symbol, 'TLKM')
})

test('domain/stocks: searchLocalStocks("T") returns T tickers with TLKM included', () => {
  const results = searchLocalStocks('T', 8)
  assert.ok(results.length > 0)
  const symbols = results.map((r) => r.symbol)
  assert.ok(symbols.includes('TLKM'))
  assert.ok(symbols.includes('TBIG') || symbols.includes('TPIA'))
})

test('domain/stocks: getStockRelevanceScore ranks prefix matches above substring matches', () => {
  const tlkmScore = getStockRelevanceScore('TL', { symbol: 'TLKM', name: 'Telkom Indonesia Tbk' })
  const atlasScore = getStockRelevanceScore('TL', { symbol: 'ARII', name: 'Atlas Resources Tbk' })
  const gjtlScore = getStockRelevanceScore('TL', { symbol: 'GJTL', name: 'Gajah Tunggal Tbk' })

  // TLKM (symbol starts with TL + popular bonus) must be much higher than ARII (name contains tl)
  assert.ok(tlkmScore > atlasScore, 'TLKM score must be higher than Atlas Resources')
  assert.ok(tlkmScore > gjtlScore, 'TLKM score must be higher than Gajah Tunggal')
})

test('domain/stocks: getStockRelevanceScore returns 0 for non-matching stock', () => {
  const score = getStockRelevanceScore('XYZW', { symbol: 'BBCA', name: 'Bank Central Asia Tbk' })
  assert.equal(score, 0)
})
