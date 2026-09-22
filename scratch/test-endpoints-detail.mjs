import fs from 'fs'

let apiKey = ''
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8')
  const match = envContent.match(/SECTORS_API_KEY=["']?([^"'\r\n]+)["']?/)
  if (match) apiKey = match[1]
}

async function run() {
  for (const sec of ['insiders', 'shareholders', 'segments', 'overview', 'peers', 'management', 'financials', 'valuation']) {
    const res = await fetch('https://api.sectors.app/v2/company/report/BBCA/?sections=' + sec, {
      headers: { Authorization: apiKey },
    })
    const d = await res.json()
    console.log(sec, '=> status:', res.status, 'error:', d.error || 'OK')
  }
}

run().catch(console.error)
