import fs from 'node:fs'
import path from 'node:path'

// Read .env.local
const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf8')
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=["']?([^"'\r\n]+)["']?/)
  if (match) {
    process.env[match[1]] = match[2]
  }
}

const apiKey = process.env.SECTORS_API_KEY
console.log('=== TEST SECTORS API DIRECT REQUESTS ===')
console.log('API Key:', apiKey ? `${apiKey.slice(0, 8)}...` : 'NONE')

async function testApi(name, url) {
  try {
    const start = Date.now()
    const res = await fetch(url, {
      headers: {
        Authorization: apiKey || '',
      },
    })
    const duration = Date.now() - start
    const status = res.status
    const text = await res.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      // not json
    }
    console.log(`\n-----------------------------------------`)
    console.log(`[${name}]`)
    console.log(`URL   : ${url}`)
    console.log(`Status: ${status} ${res.statusText} (${duration}ms)`)
    if (json) {
      if (Array.isArray(json)) {
        console.log(`Format: Array of ${json.length} items`)
        if (json.length > 0) {
          console.log(`Sample [0]:`, JSON.stringify(json[0], null, 2).slice(0, 300))
        }
      } else if (typeof json === 'object') {
        const keys = Object.keys(json)
        console.log(`Format: Object with keys [${keys.join(', ')}]`)
        if (json.data && Array.isArray(json.data)) {
          console.log(`json.data items: ${json.data.length}`)
          if (json.data.length > 0) {
            console.log(`json.data[0]:`, JSON.stringify(json.data[0], null, 2).slice(0, 300))
          }
        } else if (json.results && Array.isArray(json.results)) {
          console.log(`json.results items: ${json.results.length}`)
          if (json.results.length > 0) {
            console.log(`json.results[0]:`, JSON.stringify(json.results[0], null, 2).slice(0, 300))
          }
        } else {
          console.log(`Sample:`, JSON.stringify(json, null, 2).slice(0, 400))
        }
      }
    } else {
      console.log(`Response text:`, text.slice(0, 200))
    }
    return { name, status, ok: res.ok, data: json }
  } catch (err) {
    console.error(`[${name}] ERROR:`, err.message)
    return { name, error: err.message }
  }
}

// 1. Fundamental
await testApi('1. Fundamental (Valuation)', 'https://api.sectors.app/v2/company/report/BBCA/?sections=valuation')

// 2. Arus Broker (Broker Summary & Brokers Registry)
const today = new Date().toISOString().split('T')[0]
const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0]
await testApi('2a. Arus Broker (Summary)', `https://api.sectors.app/v2/broker-summary/BBCA/?start=${tenDaysAgo}&end=${today}`)
await testApi('2b. Arus Broker (Registry)', 'https://api.sectors.app/v2/brokers/')

// 3. Katalis Berita
await testApi('3. Katalis Berita (News)', 'https://api.sectors.app/v2/news/?symbols=BBCA&limit=5')

// 4. Transaksi Orang Dalam
await testApi('4. Transaksi Orang Dalam (Filings)', 'https://api.sectors.app/v2/filings/?symbol=BBCA&limit=5')

// 5. Daily Transactions with daysBack = 30 vs daysBack = 60 vs daysBack = 90
const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0]
const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]

console.log('\n=========================================')
console.log('TESTING DAILY ROWS FOR SMA-20')
console.log(`Today: ${today}`)
console.log(`30 days ago: ${thirtyDaysAgo}`)
console.log(`60 days ago: ${sixtyDaysAgo}`)
console.log(`90 days ago: ${ninetyDaysAgo}`)

const d30 = await testApi('5a. Daily 30 days', `https://api.sectors.app/v2/daily/BBCA/?start=${thirtyDaysAgo}&end=${today}`)
const d60 = await testApi('5b. Daily 60 days', `https://api.sectors.app/v2/daily/BBCA/?start=${sixtyDaysAgo}&end=${today}`)
const d90 = await testApi('5c. Daily 90 days', `https://api.sectors.app/v2/daily/BBCA/?start=${ninetyDaysAgo}&end=${today}`)

if (d30.data && Array.isArray(d30.data)) {
  console.log(`\n--> Total trading days in 30 calendar days: ${d30.data.length}`)
  console.log(`--> Is count >= 21? ${d30.data.length >= 21 ? 'YES' : 'NO (KARENA ITU SMA-20 JADI "-")'}`)
}
if (d60.data && Array.isArray(d60.data)) {
  console.log(`--> Total trading days in 60 calendar days: ${d60.data.length}`)
}
if (d90.data && Array.isArray(d90.data)) {
  console.log(`--> Total trading days in 90 calendar days: ${d90.data.length}`)
}
