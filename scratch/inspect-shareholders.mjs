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
  const { fetchCompanyShareholders } = await import('../lib/server/providers/sectors.ts')
  const res = await fetchCompanyShareholders('BBCA')
  console.log('fetchCompanyShareholders envelope state:', res.state)
  console.log('fetchCompanyShareholders data keys:', Object.keys(res.data || {}))
  console.log('topShareholders:', res.data?.topShareholders)
  console.log('monthlyReports count:', res.data?.monthlyReports?.length)
  if (res.data?.monthlyReports?.length > 0) {
    console.log('monthlyReports[0]:', res.data.monthlyReports[0])
  }

  const rawRes = await fetch('https://api.sectors.app/v2/company/shareholders-composition/BBCA/', {
    headers: { Authorization: process.env.SECTORS_API_KEY },
  })
  const rawJson = await rawRes.json()
  console.log('\nRaw API /v2/company/shareholders-composition/BBCA/ sample:')
  if (Array.isArray(rawJson)) {
    console.log('Raw is Array of length', rawJson.length)
    console.log('Raw[0] keys:', Object.keys(rawJson[0]))
    console.log('Raw[0]:', JSON.stringify(rawJson[0], null, 2))
  } else {
    console.log('Raw is Object with keys:', Object.keys(rawJson))
    console.log('Raw:', JSON.stringify(rawJson, null, 2).slice(0, 500))
  }
}

run().catch(console.error)
