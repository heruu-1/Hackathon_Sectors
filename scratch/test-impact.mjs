import fs from 'node:fs'
import path from 'node:path'

// Read .env.local
const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf8')
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=["']?([^"'\r\n]+)["']?/)
  if (match) {
    process.env[match[1]] = match[2]
  }
}

console.log('GEMINI_API_KEY present:', !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here')

import { analyzeNewsImpact, fallbackAnalyzeNews } from '../lib/server/providers/gemini.ts'

const testTitle = 'PT Siloam International Hospitals Tbk (SILO) to add Rp8.88 trillion debt for acquisition of 14 hospitals'
const testBody = 'PT Siloam International Hospitals Tbk (SILO) announced a plan to acquire 14 hospital assets from First REIT.'

console.log('\n--- Testing fallbackAnalyzeNews ---')
const fallbackResult = fallbackAnalyzeNews(testTitle, testBody)
console.log('Fallback result:', fallbackResult)

console.log('\n--- Testing analyzeNewsImpact ---')
const impactResult = await analyzeNewsImpact(testTitle, testBody, 'SILO')
console.log('Impact result:', impactResult)
