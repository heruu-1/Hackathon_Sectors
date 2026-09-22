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

async function run() {
  const res = await fetch('https://api.sectors.app/v2/company/report/BBCA/?sections=ownership', {
    headers: { Authorization: process.env.SECTORS_API_KEY },
  })
  const json = await res.json()
  console.log('Ownership section keys:', Object.keys(json.ownership || {}))
  console.log('Ownership full sample:', JSON.stringify(json.ownership, null, 2))
}

run().catch(console.error)
