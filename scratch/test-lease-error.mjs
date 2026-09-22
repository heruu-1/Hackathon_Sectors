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
  const { db } = await import('../db/index.ts')
  const { cacheLeases } = await import('../db/schema.ts')
  try {
    await db.delete(cacheLeases)
  } catch (err) {
    console.log('Error type:', typeof err, err.constructor.name)
    console.log('Error message:', err.message)
    console.log('Error instanceof Error:', err instanceof Error)
    console.log('Error code:', err.code)
    console.log('Error keys:', Object.keys(err))
    console.log('Full error:', err)
  }
}

test().catch(console.error)
