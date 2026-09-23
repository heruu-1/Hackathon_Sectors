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

async function test() {
  console.log('--- Testing Broker Activity Service ---')
  const { getBrokersRegistryList, getBrokerActivityService } =
    await import('../lib/server/services/broker-activity.ts')

  const t0 = Date.now()
  const registry = await getBrokersRegistryList()
  console.log(
    `getBrokersRegistryList took: ${Date.now() - t0}ms, count: ${Object.keys(registry || {}).length}`,
  )

  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - 4 * 86_400_000).toISOString().split('T')[0]

  const t1 = Date.now()
  const act = await getBrokerActivityService('YP', startDate, endDate)
  console.log(
    `getBrokerActivityService took: ${Date.now() - t1}ms, broker: ${act?.brokerName}, topBuy: ${act?.topAccumulatedStocks?.[0]?.symbol}`,
  )
}

test().catch(console.error)
