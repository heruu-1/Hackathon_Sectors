import fs from 'node:fs'
import path from 'node:path'

import { getMarketRadarFeed } from '../app/actions.ts'

// Read .env.local
const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf8')
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=["']?([^"'\r\n]+)["']?/)
  if (match) {
    process.env[match[1]] = match[2]
  }
}

console.log('=== MEMANGGIL getMarketRadarFeed() ===')
const res = await getMarketRadarFeed()

console.log('Sukses:', res.success)
if (res.data) {
  console.log(`Jumlah sleepingGiants: ${res.data.sleepingGiants.length}`)
  console.log(`Jumlah insiderAlerts : ${res.data.insiderAlerts.length}`)
  console.log(`Recent news count    : ${res.data.recentNewsCount}`)
  console.log(`Recent filings count : ${res.data.recentFilingsCount}`)

  if (res.data.sleepingGiants.length > 0) {
    console.log('\n--- DAFTAR SLEEPING GIANTS ---')
    res.data.sleepingGiants.forEach((item, idx) => {
      console.log(`\n[${idx + 1}] Ticker: ${item.ticker}`)
      console.log(`    Headline : ${item.headline}`)
      console.log(`    Sentimen : ${item.sentiment} (Score: ${item.impactScore})`)
      console.log(
        `    PriceChg : ${item.priceChangePct !== null ? `${item.priceChangePct}%` : 'null'}`,
      )
      console.log(`    Verdict  : ${item.verdict}`)
    })
  } else {
    console.log('\nTidak ada sleepingGiants yang lolos kriteria.')
  }
} else {
  console.error('Error:', res.error)
}
