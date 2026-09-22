import fs from 'fs'

let apiKey = ''
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8')
  const match = envContent.match(/SECTORS_API_KEY=["']?([^"'\r\n]+)["']?/)
  if (match) apiKey = match[1]
}

async function test(label, queryObj) {
  const p = new URLSearchParams(queryObj)
  const url = 'https://api.sectors.app/v2/companies/?' + p.toString()
  console.log(`\n=== ${label} ===`)
  console.log('URL:', url)
  const res = await fetch(url, { headers: { Authorization: apiKey } })
  console.log('Status:', res.status)
  const text = await res.text()
  console.log('Response:', text.slice(0, 300))
}

// Test 1: order_by=-market_cap
await test('Test 1: order_by=-market_cap', { limit: '25', order_by: '-market_cap' })

// Test 2: order_by=market_cap&order_direction=desc
await test('Test 2: order_by=market_cap&order_direction=desc', {
  limit: '25',
  order_by: 'market_cap',
  order_direction: 'desc',
})

// Test 3: with BASE_COLUMNS_WHERE
const BASE_COLUMNS_WHERE = [
  '(sector is not null or sector is null)',
  '(sub_sector is not null or sub_sector is null)',
  '(last_close_price is not null or last_close_price is null)',
  '(pe_ttm is not null or pe_ttm is null)',
  '(pb_mrq is not null or pb_mrq is null)',
  '(yield_ttm is not null or yield_ttm is null)',
  '(roe_ttm is not null or roe_ttm is null)',
  '(daily_close_change is not null or daily_close_change is null)',
  '(yoy_quarter_earnings_growth is not null or yoy_quarter_earnings_growth is null)',
].join(' and ')
await test('Test 3: BASE_COLUMNS_WHERE', { limit: '25', where: BASE_COLUMNS_WHERE })

// Test 4: where: market_cap > 0
await test('Test 4: where market_cap > 0', {
  limit: '25',
  where: 'market_cap > 0',
  order_by: 'market_cap',
  order_direction: 'desc',
})
