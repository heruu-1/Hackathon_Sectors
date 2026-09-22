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
  const { readStockData } = await import('../lib/server/services/analysis.ts')
  const data = await readStockData('BBCA')
  console.log('--- PEER COMPARISON ---')
  console.log('peRank:', data.peerComparison.peRank)
  console.log('pbRank:', data.peerComparison.pbRank)
  console.log('roeRank:', data.peerComparison.roeRank)
  console.log('dividendYieldRank:', data.peerComparison.dividendYieldRank)
  console.log('peers length:', data.peerComparison.peers.length)
  if (data.peerComparison.peers.length > 0) {
    console.log('peer 0:', data.peerComparison.peers[0])
  }

  console.log('\n--- OWNERSHIP ---')
  console.log('freeFloat:', data.ownership.freeFloat)
  console.log('totalControllingPct:', data.ownership.totalControllingPct)
  console.log('shift:', data.ownership.shift)
  console.log('topShareholders count:', data.ownership.topShareholders?.length)
  if (data.ownership.topShareholders?.length > 0) {
    console.log('shareholder 0:', data.ownership.topShareholders[0])
  }

  console.log('\n--- BUSINESS EXPOSURE ---')
  console.log('segments count:', data.businessExposure.segments?.length)
  if (data.businessExposure.segments?.length > 0) {
    console.log('segment 0:', data.businessExposure.segments[0])
  }

  console.log('\n--- ENVELOPES ---')
  for (const [k, v] of Object.entries(data.envelopes)) {
    console.log(`envelope ${k}: state=${v?.state}, data=${Array.isArray(v?.data) ? `Array(${v.data.length})` : typeof v?.data}, error=${v?.error}`)
  }
}

run().catch(console.error)
