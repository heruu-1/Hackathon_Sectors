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
const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]

const res = await fetch(`https://api.sectors.app/v2/daily/BBCA/?start=${ninetyDaysAgo}&end=${today}`, {
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
console.log(`Total rows fetched (90 days): ${rows.length}`)

// The table displays the last 30 rows reversed
const sortedRows = [...rows].sort((a, b) => a.date.localeCompare(b.date))
const tableRows = [...sortedRows].reverse().slice(0, 30)

console.log(`\nTable shows ${tableRows.length} rows:`)
let filledCount = 0
for (const row of tableRows) {
  const originalIndex = sortedRows.findIndex((r) => r.date === row.date)
  const sma = originalIndex >= 0 ? smaValues[originalIndex] : null
  if (sma !== null) filledCount++
  console.log(`Date: ${row.date} | Close: Rp ${row.close} | SMA-20: ${sma !== null ? 'Rp ' + sma : '—'}`)
}

console.log(`\nResult: ${filledCount} of ${tableRows.length} rows have valid SMA-20 values!`)
