import fs from 'node:fs'
import path from 'node:path'

// 1. Read .env.local
let apiKey = process.env.SECTORS_API_KEY
if (!apiKey) {
  try {
    const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf8')
    const match = envContent.match(/SECTORS_API_KEY=["']?([^"'\r\n]+)["']?/)
    if (match) {
      apiKey = match[1].trim()
    }
  } catch (err) {
    console.error('Tidak dapat membaca .env.local:', err.message)
  }
}

console.log('=== TEST KONEKSI SECTORS API NEWS ===')
console.log(
  'API Key terdeteksi:',
  apiKey ? `Ya (panjang: ${apiKey.length} karakter)` : 'TIDAK ADA / KOSONG',
)

if (!apiKey || apiKey === 'your_sectors_api_key_here') {
  console.error('\n[PERINGATAN] SECTORS_API_KEY belum diisi atau masih berupa placeholder!')
  process.exit(1)
}

async function testFetch(url, label) {
  console.log(`\n--- Menguji ${label} ---`)
  console.log(`URL: ${url}`)
  try {
    const start = Date.now()
    const res = await fetch(url, {
      headers: {
        Authorization: apiKey,
      },
      signal: AbortSignal.timeout(10000),
    })
    const duration = Date.now() - start
    console.log(`Status: ${res.status} ${res.statusText} (${duration}ms)`)

    if (!res.ok) {
      const text = await res.text()
      console.error(`Error Body: ${text}`)
      return
    }

    const data = await res.json()
    const results = data.results || (Array.isArray(data) ? data : [])
    console.log(`Jumlah berita didapat: ${results.length}`)

    if (results.length > 0) {
      results.slice(0, 3).forEach((item, idx) => {
        console.log(`\n[Berita ${idx + 1}]`)
        console.log(`  Judul  : ${item.title}`)
        console.log(`  Waktu  : ${item.timestamp}`)
        console.log(`  Simbol : ${JSON.stringify(item.symbols ?? [])}`)
        console.log(`  Sumber : ${item.source || 'N/A'}`)
        if (item.body) {
          console.log(`  Cuplikan: ${item.body.slice(0, 100)}...`)
        }
      })
    } else {
      console.log('Respons JSON:', JSON.stringify(data, null, 2))
    }
  } catch (err) {
    console.error(`Gagal melakukan fetch:`, err.message)
  }
}

async function run() {
  // Test 1: General IDX news
  await testFetch(
    'https://api.sectors.app/v2/news/?extension=idx&limit=5',
    'Berita Pasar Umum (extension=idx)',
  )

  // Test 2: Specific ticker news (BBCA)
  await testFetch(
    'https://api.sectors.app/v2/news/?symbols=BBCA&limit=5',
    'Berita Saham Spesifik (symbols=BBCA)',
  )

  // Test 3: Specific ticker news (BBRI)
  await testFetch(
    'https://api.sectors.app/v2/news/?symbols=BBRI&limit=5',
    'Berita Saham Spesifik (symbols=BBRI)',
  )
}

run()
