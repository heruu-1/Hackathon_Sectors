import fs from 'fs'

let apiKey = ''
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8')
  const match = envContent.match(/SECTORS_API_KEY=["']?([^"'\r\n]+)["']?/)
  if (match) apiKey = match[1]
}

async function run() {
  const res = await fetch('https://api.sectors.app/v2/company/report/BBCA/?sections=overview,management,financials,peers,valuation', {
    headers: { Authorization: apiKey },
  })
  console.log('Status:', res.status)
  const data = await res.json()
  console.log('Keys in data:', Object.keys(data))
  if (data.overview) console.log('data.overview keys:', Object.keys(data.overview))
  if (data.peers) console.log('data.peers keys/sample:', Array.isArray(data.peers) ? data.peers.slice(0, 2) : Object.keys(data.peers))
  if (data.management) console.log('data.management sample:', Array.isArray(data.management) ? data.management.slice(0, 2) : Object.keys(data.management))
}

run().catch(console.error)
