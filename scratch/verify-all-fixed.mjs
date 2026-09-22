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
  console.log('Testing readStockData("BBCA")...')
  const { readStockData } = await import('../lib/server/services/analysis.ts')
  const t0 = Date.now()
  const data = await readStockData('BBCA', { forceRefresh: true })
  console.log(`readStockData took ${Date.now() - t0}ms`)
  console.log('Company:', data.companyName)
  console.log('Price:', data.price, 'Change:', data.priceChangeFraction)
  console.log('Daily rows count:', data.dailyRows.length)
  console.log('Peers count:', data.peers.length)
  console.log('Ownership analysis:', {
    symbol: data.ownership?.symbol,
    totalControllingPct: data.ownership?.totalControllingPct,
    categoriesCount: data.ownership?.currentComposition?.categories?.length,
    shift: data.ownership?.shift,
  })
  console.log('Business exposure:', {
    symbol: data.businessExposure?.symbol,
    segmentsCount: data.businessExposure?.segments?.length,
    largestSegment: data.businessExposure?.largestSegment,
    concentrationLevel: data.businessExposure?.concentrationLevel,
  })
}

run().catch(console.error)
