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
  const { fetchQuarterlyFinancials } = await import('../lib/server/providers/quarterly.ts')
  const res = await fetchQuarterlyFinancials('BBCA')
  console.log('fetchQuarterlyFinancials length:', res.data?.length)
  console.log(
    'Quarters:',
    res.data?.map((q) => q.quarter),
  )
  console.log('Item 0:', res.data?.[0])
  if (res.data && res.data.length > 1) {
    console.log('Item 1:', res.data[1])
  }
}

run().catch(console.error)
