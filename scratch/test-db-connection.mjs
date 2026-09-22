import fs from 'fs'
import postgres from 'postgres'

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
  console.log('Testing DB connection to:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'))
  const t0 = Date.now()
  const sql = postgres(process.env.DATABASE_URL, { connect_timeout: 3 })
  try {
    const res = await sql`SELECT 1 as test`
    console.log(`DB Query succeeded in ${Date.now() - t0}ms:`, res)
  } catch (err) {
    console.error(`DB Query failed in ${Date.now() - t0}ms:`, err.message, err.code)
  } finally {
    await sql.end({ timeout: 1 })
  }
}

test().catch(console.error)
