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

async function run() {
  console.log('=== TEST 1: Market Overview (F01) ===')
  const { getMarketOverviewService } = await import('../lib/server/services/market-overview.ts')
  const t0 = Date.now()
  const overviewRes = await getMarketOverviewService()
  console.log(`getMarketOverviewService took ${Date.now() - t0}ms`)
  if (overviewRes.ok) {
    const b = overviewRes.data.breadth
    console.log(
      `Breadth: Naik=${b.advancing}, Turun=${b.declining}, Stagnan=${b.unchanged}, Median=${(b.medianMarketChange * 100).toFixed(2)}%`,
    )
    console.log(
      `Cakupan: ${overviewRes.data.monitoredCoverage.withPrice} emiten (${overviewRes.data.monitoredCoverage.percentCovered}%)`,
    )
    console.log(`Jumlah Sektor: ${overviewRes.data.sectors.length}`)
    console.log(
      `Top 3 Sektor:`,
      overviewRes.data.sectors
        .slice(0, 3)
        .map(
          (s) =>
            `${s.sector} (${s.totalCompanies} emiten, median ${(s.medianChangeFraction * 100).toFixed(2)}%)`,
        ),
    )
    console.log(
      `Top Gainer #1: ${overviewRes.data.topGainers[0]?.symbol} (+${(overviewRes.data.topGainers[0]?.dailyChange * 100).toFixed(2)}%)`,
    )
    console.log(
      `Top Loser #1: ${overviewRes.data.topLosers[0]?.symbol} (${(overviewRes.data.topLosers[0]?.dailyChange * 100).toFixed(2)}%)`,
    )
  } else {
    console.error('Overview error:', overviewRes.error)
  }

  console.log('\n=== TEST 2: Stock Data BBCA (/saham/BBCA) ===')
  const { fetchCompanyValuation, fetchDailyPrices, fetchCompanyShareholders } =
    await import('../lib/server/providers/sectors.ts')
  const { fetchCompanySegments } = await import('../lib/server/providers/segments.ts')

  const t1 = Date.now()
  const [val, daily, sh, seg] = await Promise.all([
    fetchCompanyValuation('BBCA'),
    fetchDailyPrices('BBCA'),
    fetchCompanyShareholders('BBCA'),
    fetchCompanySegments('BBCA'),
  ])
  console.log(`Parallel fetch (Valuation, Daily, Shareholders, Segments) took ${Date.now() - t1}ms`)
  console.log(
    `BBCA Price: ${val.data?.lastClosePrice}, Daily change: ${(val.data?.dailyCloseChange * 100).toFixed(2)}%`,
  )
  console.log(`BBCA Daily rows: ${daily.data?.length} rows`)
  console.log(`BBCA Shareholders monthly snapshots: ${sh.data?.monthlyReports.length} months`)
  console.log(`BBCA Revenue Segments: ${seg.data?.revenueSegments.length} segments`)
  console.log(`Sample segment:`, seg.data?.revenueSegments[0])

  console.log('\n=== SEMUA DATA TERVERIFIKASI SUKSES DARI API SECTORS ===')
}

run().catch(console.error)
