import fs from 'fs'

let apiKey = ''
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8')
  const match = envContent.match(/SECTORS_API_KEY=["']?([^"'\r\n]+)["']?/)
  if (match) apiKey = match[1]
}

async function run() {
  const ticker = 'BBCA'
  const sections = 'valuation,insiders,quarterly_financials,shareholders,segments'
  const url = `https://api.sectors.app/v2/company/report/${ticker}/?sections=${sections}`
  console.log('Fetching:', url)
  const t0 = Date.now()
  const res = await fetch(url, { headers: { Authorization: apiKey } })
  console.log(`Status: ${res.status}, took ${Date.now() - t0}ms`)
  const data = await res.json()
  console.log('Response data:', data)
  if (data.valuation) console.log('Has valuation:', Object.keys(data.valuation))
  if (data.insiders) console.log('Has insiders:', Array.isArray(data.insiders) ? data.insiders.length : typeof data.insiders)
  if (data.quarterly_financials) console.log('Has quarterly_financials:', Array.isArray(data.quarterly_financials) ? data.quarterly_financials.length : typeof data.quarterly_financials)
  if (data.shareholders) console.log('Has shareholders:', Object.keys(data.shareholders))
  if (data.segments) console.log('Has segments:', Object.keys(data.segments))
}

run().catch(console.error)
