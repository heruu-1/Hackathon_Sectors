import fs from 'fs'

if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8')
  for (const line of envContent.split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
    if (m) {
      const key = m[1]
      let val = m[2] || ''
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
      process.env[key] = val
    }
  }
}

async function profile() {
  console.log('--- Step 1: Direct fetch to sectors API companies ---')
  const t0 = Date.now()
  const BASE_COLUMNS_WHERE = [
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

  const params = new URLSearchParams({
    limit: '200',
    order_by: '-market_cap',
    include_query_values: 'true',
    where: BASE_COLUMNS_WHERE,
  })

  const url = `https://api.sectors.app/v2/companies/?${params.toString()}`
  console.log('Fetching:', url.slice(0, 100) + '...')
  const fetchStart = Date.now()
  const res = await fetch(url, { headers: { Authorization: process.env.SECTORS_API_KEY } })
  console.log(`Direct fetch took: ${Date.now() - fetchStart}ms, status: ${res.status}`)
  const jsonStart = Date.now()
  const data = await res.json()
  console.log(`JSON parse took: ${Date.now() - jsonStart}ms, results count: ${data.results?.length}`)

  console.log('\n--- Step 2: requestSectorsShared ---')
  const { requestSectorsShared } = await import('../lib/server/providers/transport.ts')
  const t2 = Date.now()
  await requestSectorsShared(url, { capabilityId: 'companies_screener' })
  console.log(`requestSectorsShared took: ${Date.now() - t2}ms`)

  console.log('\n--- Step 3: fetchUniverseCompanies ---')
  const { fetchUniverseCompanies } = await import('../lib/server/providers/sectors.ts')
  const t3 = Date.now()
  await fetchUniverseCompanies(200, { forceRefresh: true })
  console.log(`fetchUniverseCompanies took: ${Date.now() - t3}ms`)
}

profile().catch(console.error)
