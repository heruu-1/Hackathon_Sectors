import fs from 'fs'

let apiKey = ''
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8')
  const match = envContent.match(/SECTORS_API_KEY=["']?([^"'\r\n]+)["']?/)
  if (match) apiKey = match[1]
}

async function run() {
  const where = [
    '(sector is not null or sector is null)',
    '(sub_sector is not null or sub_sector is null)',
    '(last_close_price is not null or last_close_price is null)',
    '(market_cap is not null or market_cap is null)',
    '(daily_close_change is not null or daily_close_change is null)',
    '(pe_ttm is not null or pe_ttm is null)',
    '(pb_mrq is not null or pb_mrq is null)',
    '(yield_ttm is not null or yield_ttm is null)',
    '(roe_ttm is not null or roe_ttm is null)',
    '(yoy_quarter_earnings_growth is not null or yoy_quarter_earnings_growth is null)',
    '(yoy_quarter_revenue_growth is not null or yoy_quarter_revenue_growth is null)',
  ].join(' and ')

  const url = `https://api.sectors.app/v2/companies/?limit=3&include_query_values=true&order_by=-market_cap&where=${encodeURIComponent(where)}`
  console.log('Fetching:', url)
  const res = await fetch(url, { headers: { Authorization: apiKey } })
  console.log('Status:', res.status)
  const data = await res.json()
  console.log('Results sample:', JSON.stringify(data.results, null, 2))
}

run().catch(console.error)
