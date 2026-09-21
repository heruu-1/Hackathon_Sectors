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
const today = new Date().toISOString().split('T')[0]
const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0]

const res = await fetch(`https://api.sectors.app/v2/daily/BBCA/?start=${sixtyDaysAgo}&end=${today}`, {
  headers: { Authorization: apiKey },
})
const rows = await res.json()

// Import calculatePriceSma20 logic
function calculatePriceSma20(rows) {
  if (!rows || rows.length < 21) {
    return rows ? rows.map(() => null) : []
  }
  const result = []
  for (let i = 0; i < rows.length; i++) {
    if (i < 20) {
      result.push(null)
    } else {
      const window = rows.slice(i - 20, i)
      const sum = window.reduce((acc, r) => acc + r.close, 0)
      result.push(Math.round(sum / 20))
    }
  }
  return result
}

const smaValues = calculatePriceSma20(rows)
console.log(`Total rows fetched (60 days): ${rows.length}`)
console.log('Sample latest 5 rows with SMA-20:')
for (let i = rows.length - 5; i < rows.length; i++) {
  console.log(`Date: ${rows[i].date} | Close: Rp ${rows[i].close} | SMA-20: ${smaValues[i] ? 'Rp ' + smaValues[i] : '—'}`)
}
