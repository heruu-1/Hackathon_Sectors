import fs from 'node:fs'
import path from 'node:path'

import { calculatePriceSma20 } from '../lib/presentation/stock.ts'
import { readStockData } from '../lib/server/services/analysis.ts'

// Read .env.local
const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf8')
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=["']?([^"'\r\n]+)["']?/)
  if (match) {
    process.env[match[1]] = match[2]
  }
}

// Let's test reading TLKM
const res = await readStockData('TLKM', { forceRefresh: true })
const rows = res.envelopes.daily.data || []
console.log('TLKM daily rows count:', rows.length)
if (rows.length > 0) {
  console.log('Latest row:', rows[rows.length - 1])
}
const sma = calculatePriceSma20(rows)
console.log('Latest 5 SMA:', sma.slice(-5))
process.exit(0)
