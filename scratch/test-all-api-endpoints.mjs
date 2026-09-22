import fs from 'fs'

if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8')
  for (const line of envContent.split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
    if (m) {
      const key = m[1]
      let val = m[2] || ''
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
      process.env[key] = val
    }
  }
}

async function testUrl(url) {
  try {
    const res = await fetch(url, { headers: { Authorization: process.env.SECTORS_API_KEY } })
    if (res.ok) {
      const json = await res.json()
      console.log(`[SUCCESS 200] ${url}`)
      console.log('Sample:', Array.isArray(json) ? `Array(${json.length})` : Object.keys(json))
      return true
    } else {
      const text = await res.text()
      if (!text.includes('does not exist') && !text.includes('not found') && res.status !== 404) {
        console.log(`[STATUS ${res.status}] ${url} -> ${text.slice(0, 150)}`)
      }
      return false
    }
  } catch (err) {
    console.error('Error:', err.message)
    return false
  }
}

async function run() {
  const symbol = 'BBCA'
  const endpoints = [
    // company report sections
    `https://api.sectors.app/v2/company/report/${symbol}/?sections=overview`,
    `https://api.sectors.app/v2/company/report/${symbol}/?sections=profile`,
    `https://api.sectors.app/v2/company/report/${symbol}/?sections=management`,
    `https://api.sectors.app/v2/company/report/${symbol}/?sections=ownership`,
    `https://api.sectors.app/v2/company/report/${symbol}/?sections=dividend`,
    `https://api.sectors.app/v2/company/report/${symbol}/?sections=dividends`,
    `https://api.sectors.app/v2/company/report/${symbol}/?sections=peers`,
    `https://api.sectors.app/v2/company/report/${symbol}/?sections=top_shareholders`,
    `https://api.sectors.app/v2/company/report/${symbol}/?sections=major_shareholders`,
    
    // possible standalone endpoints
    `https://api.sectors.app/v2/company/get-top-shareholders/${symbol}/`,
    `https://api.sectors.app/v2/company/top-shareholders/${symbol}/`,
    `https://api.sectors.app/v2/company/get-shareholders/${symbol}/`,
    `https://api.sectors.app/v2/company/get-major-shareholders/${symbol}/`,
    `https://api.sectors.app/v2/company/get-ownership/${symbol}/`,
    `https://api.sectors.app/v2/company/ownership/${symbol}/`,
    `https://api.sectors.app/v2/company/overview/${symbol}/`,
    `https://api.sectors.app/v2/company/profile/${symbol}/`,
    `https://api.sectors.app/v2/company/management/${symbol}/`,
    
    // other endpoints
    `https://api.sectors.app/v2/companies/top-shareholders/${symbol}/`,
    `https://api.sectors.app/v2/companies/shareholders/${symbol}/`,
    `https://api.sectors.app/v2/shareholders/${symbol}/`,
  ]

  for (const ep of endpoints) {
    await testUrl(ep)
  }
}

run().catch(console.error)
