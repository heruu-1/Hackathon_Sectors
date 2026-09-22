import fs from 'fs'

let apiKey = ''
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8')
  const match = envContent.match(/SECTORS_API_KEY=["']?([^"'\r\n]+)["']?/)
  if (match) apiKey = match[1]
}

async function test() {
  const r1 = await fetch('https://api.sectors.app/v2/company/shareholders-composition/BBCA/', {
    headers: { Authorization: apiKey },
  })
  console.log('shareholders-composition status:', r1.status)
  const d1 = await r1.json()
  console.log('shareholders-composition data sample:', JSON.stringify(d1).slice(0, 300))

  const r2 = await fetch('https://api.sectors.app/v2/company/get-segments/BBCA/', {
    headers: { Authorization: apiKey },
  })
  console.log('get-segments status:', r2.status)
  const d2 = await r2.json()
  console.log('get-segments data sample:', JSON.stringify(d2).slice(0, 300))
}

test().catch(console.error)
