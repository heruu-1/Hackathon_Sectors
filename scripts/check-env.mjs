import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ServerEnvSchema, getSanitizedEnvSummary } from '../lib/server/env.ts'

// Optional dotenv loading if running standalone without next/cli
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim()
        let val = trimmed.slice(eqIdx + 1).trim()
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1)
        }
        if (!process.env[key]) {
          process.env[key] = val
        }
      }
    }
  }
}

loadEnvFile(path.join(rootDir, '.env.local'))
loadEnvFile(path.join(rootDir, '.env'))

console.log('=== Pengecekan Konfigurasi Environment RASI ===')
const summary = getSanitizedEnvSummary()
for (const [key, val] of Object.entries(summary)) {
  console.log(`  ${key}: ${val}`)
}

const result = ServerEnvSchema.safeParse(process.env)
if (!result.success) {
  console.error('\n❌ Validasi Environment GAGAL:')
  for (const issue of result.error.issues) {
    console.error(`  - [${issue.path.join('.')}] ${issue.message}`)
  }
  process.exit(1)
}

console.log('\n✅ Konfigurasi environment valid dan aman untuk dijalankan.')
process.exit(0)
