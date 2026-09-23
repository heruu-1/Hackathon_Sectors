import fs from 'fs'

let apiKey = ''
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8')
  const match = envContent.match(/SECTORS_API_KEY=["']?([^"'\r\n]+)["']?/)
  if (match) apiKey = match[1]
}

const endpoints = [
  { name: 'valuation', url: 'https://api.sectors.app/v2/company/report/BBCA/?sections=valuation' },
  { name: 'daily', url: 'https://api.sectors.app/v2/daily/BBCA/?start=2026-06-24&end=2026-09-22' },
  {
    name: 'broker-summary',
    url: 'https://api.sectors.app/v2/broker-summary/BBCA/?start=2026-09-12&end=2026-09-22',
  },
  { name: 'brokers-reg', url: 'https://api.sectors.app/v2/brokers/' },
  { name: 'news', url: 'https://api.sectors.app/v2/news/?extension=idx&limit=5&symbols=BBCA' },
  { name: 'insiders', url: 'https://api.sectors.app/v2/company/report/BBCA/?sections=insiders' },
  { name: 'quarterly', url: 'https://api.sectors.app/v2/financials/quarterly/BBCA/' },
  {
    name: 'shareholders',
    url: 'https://api.sectors.app/v2/company/report/BBCA/?sections=shareholders',
  },
  { name: 'segments', url: 'https://api.sectors.app/v2/company/report/BBCA/?sections=segments' },
  {
    name: 'companies-200',
    url: 'https://api.sectors.app/v2/companies/?limit=200&order_by=-market_cap',
  },
]

async function testAll() {
  console.log('Testing each endpoint in parallel (with Promise.all):')
  const t0 = Date.now()
  const results = await Promise.all(
    endpoints.map(async (ep) => {
      const tStart = Date.now()
      try {
        const res = await fetch(ep.url, { headers: { Authorization: apiKey } })
        const took = Date.now() - tStart
        return { name: ep.name, status: res.status, took }
      } catch (err) {
        return { name: ep.name, error: err.message, took: Date.now() - tStart }
      }
    }),
  )
  console.log(`All done in ${Date.now() - t0}ms:`)
  console.table(results)
}

testAll().catch(console.error)
