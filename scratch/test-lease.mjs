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
  const { acquireCacheLease, isDbTemporarilyUnavailable } = await import('../lib/server/cache.ts')
  console.log('isDbTemporarilyUnavailable before:', isDbTemporarilyUnavailable())
  const t0 = Date.now()
  const res = await acquireCacheLease('test-key', 'holder-1')
  console.log(`acquireCacheLease took ${Date.now() - t0}ms, returned:`, res)
  console.log('isDbTemporarilyUnavailable after:', isDbTemporarilyUnavailable())
}

test().catch(console.error)
