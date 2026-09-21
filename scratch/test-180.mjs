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
const daysAgo180 = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0]

const res = await fetch(`https://api.sectors.app/v2/daily/BBCA/?start=${daysAgo180}&end=${today}`, {
  headers: { Authorization: apiKey },
})
const data = await res.json()
console.log('180 days -> Total rows:', Array.isArray(data) ? data.length : data)
