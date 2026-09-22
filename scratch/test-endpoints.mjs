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
    console.log(`URL: ${url} -> Status: ${res.status}`)
    const text = await res.text()
    console.log('Result:', text.slice(0, 300))
  } catch (err) {
    console.error('Fetch error:', err.message)
  }
}

async function run() {
  await testUrl('https://api.sectors.app/v2/company/report/BBCA/?sections=foo')
  await testUrl('https://api.sectors.app/v2/company/shareholders/BBCA/')
  await testUrl('https://api.sectors.app/v2/company/top-shareholders/BBCA/')
  await testUrl('https://api.sectors.app/v2/company/major-shareholders/BBCA/')
  await testUrl('https://api.sectors.app/v2/company/holders/BBCA/')
  await testUrl('https://api.sectors.app/v2/company/profile/BBCA/')
}

run().catch(console.error)
