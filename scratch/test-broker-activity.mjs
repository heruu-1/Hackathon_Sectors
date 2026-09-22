import fs from 'fs'

let apiKey = ''
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8')
  const match = envContent.match(/SECTORS_API_KEY=["']?([^"'\r\n]+)["']?/)
  if (match) apiKey = match[1]
}

console.log('API Key present:', !!apiKey)

const today = new Date().toISOString().split('T')[0]
const fourteenDaysAgo = new Date(Date.now() - 13 * 86400000).toISOString().split('T')[0]

const url = `https://api.sectors.app/v2/broker-activity/YP/?start=${fourteenDaysAgo}&end=${today}`
console.log('Fetching:', url)

try {
  const res = await fetch(url, {
    headers: { Authorization: apiKey },
  })
  console.log('Status:', res.status)
  const data = await res.json()
  console.log('Type of data:', typeof data, Array.isArray(data) ? 'Array' : 'Object')
  if (Array.isArray(data)) {
    console.log('Length:', data.length)
    console.log('Sample [0]:', data[0])
  } else {
    console.log('Keys:', Object.keys(data))
    if (data.data && Array.isArray(data.data)) {
      console.log('Days count:', data.data.length)
      const flat = []
      for (const day of data.data) {
        for (const item of day.summary ?? []) {
          flat.push({
            symbol: item.symbol?.replace(/\.JK$/i, ''),
            bval: Number(item.bval) || 0,
            sval: Number(item.sval) || 0,
            nval: Number(item.nval) || (Number(item.bval) || 0) - (Number(item.sval) || 0),
            total_val: (Number(item.bval) || 0) + (Number(item.sval) || 0),
          })
        }
      }
      console.log('Total flattened transactions:', flat.length)

      // Aggregate by stock
      const stockMap = new Map()
      let totalGross = 0
      let totalNet = 0
      for (const item of flat) {
        totalGross += item.total_val
        totalNet += item.nval
        const prev = stockMap.get(item.symbol) || { symbol: item.symbol, bval: 0, sval: 0, nval: 0, total_val: 0 }
        prev.bval += item.bval
        prev.sval += item.sval
        prev.nval += item.nval
        prev.total_val += item.total_val
        stockMap.set(item.symbol, prev)
      }

      const stocks = Array.from(stockMap.values())
      console.log('Unique stocks traded by YP:', stocks.length)
      console.log('Total Gross IDR:', (totalGross / 1e9).toFixed(2), 'B')
      console.log('Total Net IDR:', (totalNet / 1e9).toFixed(2), 'B')

      const topBuy = [...stocks].sort((a, b) => b.nval - a.nval).slice(0, 5)
      console.log('\nTop 5 Net Buy:')
      for (const s of topBuy) {
        console.log(`- ${s.symbol}: Rp ${(s.nval / 1e9).toFixed(2)} M (Gross: Rp ${(s.total_val / 1e9).toFixed(2)} M)`)
      }

      const topSell = [...stocks].sort((a, b) => a.nval - b.nval).slice(0, 5)
      console.log('\nTop 5 Net Sell:')
      for (const s of topSell) {
        console.log(`- ${s.symbol}: Rp ${(s.nval / 1e9).toFixed(2)} M (Gross: Rp ${(s.total_val / 1e9).toFixed(2)} M)`)
      }
    }
  }
} catch (err) {
  console.error('Error:', err)
}
