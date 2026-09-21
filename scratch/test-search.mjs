import fs from 'fs'

// Read .env.local
let apiKey = process.env.SECTORS_API_KEY
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8')
  const match = envContent.match(/SECTORS_API_KEY=["']?([^"'\r\n]+)["']?/)
  if (match) apiKey = match[1]
}

console.log('API Key present:', !!apiKey)

const query = 'TL'
const safe = query.slice(0, 80)
const params = new URLSearchParams({
  where: `symbol like '%${safe}%' or company_name like '%${safe}%'`,
  order_by: 'symbol',
  limit: '8',
  offset: '0',
})

try {
  const url = 'https://api.sectors.app/v2/companies/?' + params.toString()
  console.log('Fetching:', url)
  const res = await fetch(url, {
    headers: { Authorization: apiKey || '' },
    signal: AbortSignal.timeout(8000),
  })
  console.log('Status:', res.status)
  const data = await res.json()
  console.log('Data:', JSON.stringify(data, null, 2))
} catch (err) {
  console.error('Error:', err)
}
