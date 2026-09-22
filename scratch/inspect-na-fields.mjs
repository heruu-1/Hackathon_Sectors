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

async function inspect(ticker) {
  console.log(`\n================ INSPECTING ${ticker} ================`)
  const { readStockData } = await import('../lib/server/services/analysis.ts')
  const data = await readStockData(ticker, { forceRefresh: true })

  console.log('price:', data.price, 'date:', data.priceDate, 'change:', data.priceChangeFraction)
  console.log('fundamentals group:', data.fundamentals?.group)
  console.log('fundamentals details:', data.fundamentals)
  console.log('ownership freeFloat:', data.ownership?.freeFloat)
  console.log('ownership totalControllingPct:', data.ownership?.totalControllingPct)
  console.log('ownership topShareholders:', data.ownership?.topShareholders?.slice(0, 3))
  console.log('peerComparison ranks:', {
    pe: data.peerComparison?.peRank,
    pb: data.peerComparison?.pbRank,
    roe: data.peerComparison?.roeRank,
    divYield: data.peerComparison?.dividendYieldRank,
  })
}

async function run() {
  await inspect('BBCA')
  await inspect('TLKM')
}

run().catch(console.error)
