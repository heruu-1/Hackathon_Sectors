import fs from 'fs'

async function run() {
  const res = await fetch('https://docs.sectors.app/llms.txt')
  const text = await res.text()
  const lines = text.split('\n').filter(l => /shareholder|ownership|holder|investor|float/i.test(l))
  console.log(lines.join('\n'))
}

run().catch(console.error)
