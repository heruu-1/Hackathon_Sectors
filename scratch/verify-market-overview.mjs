import fs from 'fs'

// Load .env.local
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

async function test() {
  const { fetchUniverseCompanies } = await import('../lib/server/providers/sectors.ts')
  const { buildMarketOverview } = await import('../domain/market-overview.ts')

  console.log('Fetching universe companies...')
  const items = await fetchUniverseCompanies(200, { forceRefresh: true })
  console.log('Got items:', items.length)
  console.log('Sample item:', items[0])

  const cutoff = new Date().toISOString().split('T')[0]
  const companies = items.map((r) => ({
    symbol: r.symbol?.replace(/\.JK$/i, '') ?? '',
    name: r.company_name ?? r.symbol ?? '',
    sector: r.sector || r.sub_sector || 'Lainnya',
    subSector: r.sub_sector,
    marketCap: r.market_cap ?? null,
    lastPrice: r.last_close_price ?? null,
    dailyChange: r.daily_close_change ?? null,
    date: r.date ?? cutoff,
  }))

  const overview = buildMarketOverview(companies, cutoff)
  console.log('\n=== MARKET OVERVIEW RESULT ===')
  console.log('Breadth:', overview.breadth)
  console.log('Coverage:', overview.monitoredCoverage)
  console.log('Sectors count:', overview.sectors.length)
  console.log('Sectors sample:', overview.sectors.slice(0, 3).map(s => ({ sector: s.sector, total: s.totalCompanies, adv: s.advancing, dec: s.declining })))
  console.log('Top Gainers count:', overview.topGainers.length, overview.topGainers.slice(0, 2))
  console.log('Top Losers count:', overview.topLosers.length, overview.topLosers.slice(0, 2))
}

test().catch(console.error)
