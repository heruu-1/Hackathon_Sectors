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

async function run() {
  console.log('Testing readStockData("BBCA")...')
  const { readStockData } = await import('../lib/server/services/analysis.ts')
  
  const t0 = Date.now()
  const data1 = await readStockData('BBCA')
  console.log(`Call 1 (cold) took ${Date.now() - t0}ms: ${data1.companyName} @ ${data1.price}`)

  const t1 = Date.now()
  const data2 = await readStockData('BBCA')
  console.log(`Call 2 (cached) took ${Date.now() - t1}ms: ${data2.companyName} @ ${data2.price}`)
}

run().catch(console.error)
