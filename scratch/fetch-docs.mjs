import fs from 'fs'

async function run() {
  const res = await fetch('https://docs.sectors.app/llms.txt')
  const text = await res.text()
  const lines = text.split('\n').filter(l => l.includes('http') || l.includes('/v2/'))
  console.log(lines.join('\n'))
}

run().catch(console.error)
