import fs from 'fs'

let apiKey = ''
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8')
  const match = envContent.match(/SECTORS_API_KEY=["']?([^"'\r\n]+)["']?/)
  if (match) apiKey = match[1]
}

async function test() {
  const res = await fetch('https://api.sectors.app/v2/company/report/BBCA/?sections=management', {
    headers: { Authorization: apiKey },
  })
  const d = await res.json()
  console.log('management:', JSON.stringify(d.management, null, 2))
}

test().catch(console.error)
