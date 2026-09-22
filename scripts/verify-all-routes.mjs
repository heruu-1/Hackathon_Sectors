import { spawn } from 'node:child_process'
import http from 'node:http'

const PORT = 3088
const BASE_URL = `http://127.0.0.1:${PORT}`

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function request(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`
  const parsed = new URL(fullUrl)

  return new Promise((resolve, reject) => {
    const req = http.request(
      parsed,
      {
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          let json = null
          try {
            json = JSON.parse(data)
          } catch {
            // Not JSON
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
            json,
          })
        })
      },
    )

    req.on('error', reject)
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
    }
    req.end()
  })
}

async function waitForServerReady(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await request('/api/health')
      if (res.status === 200) {
        return true
      }
    } catch {
      // Server not ready yet
    }
    await sleep(1000)
  }
  return false
}

async function run() {
  console.log('=== VERIFIKASI SEMUA RUTE API & FRONTEND RASI ===\n')

  console.log(`Menjalankan Next.js di 127.0.0.1:${PORT}...`)
  const server = spawn(
    process.execPath,
    ['./node_modules/next/dist/bin/next', 'start', '-p', String(PORT), '-H', '127.0.0.1'],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      env: { ...process.env, PORT: String(PORT) },
    },
  )

  server.stdout.on('data', (d) => {
    const msg = d.toString()
    console.log('Server stdout:', msg.trim())
  })

  server.stderr.on('data', (d) => {
    const msg = d.toString()
    console.error('Server stderr:', msg.trim())
  })

  try {
    const ready = await waitForServerReady()
    if (!ready) {
      throw new Error('Server Next.js gagal siap dalam batas waktu 30 detik.')
    }
    console.log('Server Next.js siap! Memulai pengujian seluruh rute...\n')

    const testCases = [
      // API Endpoints
      {
        type: 'API',
        path: '/api/health',
        method: 'GET',
        expectedStatus: 200,
        validate: (res) => res.json && (res.json.status === 'ok' || res.json.status === 'degraded'),
      },
      {
        type: 'API',
        path: '/api/stocks/search?q=BBCA',
        method: 'GET',
        expectedStatus: 200,
        validate: (res) =>
          res.json && Array.isArray(res.json.results) && res.json.results.length > 0,
      },
      {
        type: 'API',
        path: '/api/stocks/search?q=',
        method: 'GET',
        expectedStatus: 200,
        validate: (res) => res.json && Array.isArray(res.json.results),
      },
      {
        type: 'API',
        path: '/api/assistant',
        method: 'GET',
        expectedStatus: 200,
        validate: (res) => res.json && res.json.status === 'ok',
      },
      {
        type: 'API',
        path: '/api/assistant',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { message: 'Jelaskan arti P/E ratio' },
        expectedStatus: 200,
        validate: (res) =>
          res.json && typeof res.json.answer === 'string' && res.json.answer.length > 0,
      },

      // Frontend Pages
      {
        type: 'PAGE',
        path: '/',
        method: 'GET',
        expectedStatus: 200,
        validate: (res) => res.body.includes('RASI') || res.body.includes('Pasar'),
      },
      {
        type: 'PAGE',
        path: '/radar',
        method: 'GET',
        expectedStatus: 200,
        validate: (res) => res.body.includes('Radar') || res.body.includes('Berita'),
      },
      {
        type: 'PAGE',
        path: '/saham',
        method: 'GET',
        expectedStatus: 200,
        validate: (res) =>
          res.body.includes('pencarian') || res.body.includes('saham') || res.body.length > 500,
      },
      {
        type: 'PAGE',
        path: '/saham/BBCA',
        method: 'GET',
        expectedStatus: 200,
        validate: (res) => res.body.includes('BBCA') || res.body.length > 500,
      },
      {
        type: 'PAGE',
        path: '/broker',
        method: 'GET',
        expectedStatus: 200,
        validate: (res) => res.body.includes('Broker') || res.body.includes('Penelusuran'),
      },
      {
        type: 'PAGE',
        path: '/screener',
        method: 'GET',
        expectedStatus: 200,
        validate: (res) =>
          res.body.toLowerCase().includes('penyaring') ||
          res.body.toLowerCase().includes('screener') ||
          res.body.length > 500,
      },
      {
        type: 'PAGE',
        path: '/bandingkan',
        method: 'GET',
        expectedStatus: 200,
        validate: (res) =>
          res.body.toLowerCase().includes('bandingkan') ||
          res.body.toLowerCase().includes('perbandingan') ||
          res.body.length > 500,
      },
      {
        type: 'PAGE',
        path: '/watchlist',
        method: 'GET',
        expectedStatus: 200,
        validate: (res) => res.body.includes('Pantauan') || res.body.includes('Riwayat'),
      },
      {
        type: 'PAGE',
        path: '/belajar',
        method: 'GET',
        expectedStatus: 200,
        validate: (res) => res.body.includes('Belajar') || res.body.includes('istilah'),
      },
      {
        type: 'PAGE',
        path: '/pengaturan',
        method: 'GET',
        expectedStatus: 200,
        validate: (res) => res.body.includes('Pengaturan') || res.body.includes('tampilan'),
      },
      {
        type: 'PAGE',
        path: '/asisten',
        method: 'GET',
        expectedStatus: 200,
        validate: (res) => res.body.includes('Asisten') || res.body.includes('RASI'),
      },
      {
        type: 'PAGE',
        path: '/masuk',
        method: 'GET',
        expectedStatus: 200,
        validate: (res) => res.body.includes('Masuk') || res.body.includes('Google'),
      },
    ]

    let allPassed = true
    const results = []

    for (const tc of testCases) {
      try {
        const res = await request(tc.path, {
          method: tc.method,
          headers: tc.headers,
          body: tc.body,
        })

        const statusMatch = res.status === tc.expectedStatus
        const valid = statusMatch && (!tc.validate || tc.validate(res))
        if (!valid) allPassed = false

        results.push({
          type: tc.type,
          path: tc.path,
          method: tc.method,
          status: res.status,
          expected: tc.expectedStatus,
          passed: valid,
          details: valid ? 'OK' : `Status ${res.status}, body length: ${res.body.length}`,
        })
      } catch (err) {
        allPassed = false
        results.push({
          type: tc.type,
          path: tc.path,
          method: tc.method,
          status: 'ERR',
          expected: tc.expectedStatus,
          passed: false,
          details: err.message,
        })
      }
    }

    console.log('HASIL PENGUJIAN RUTE:')
    console.table(results)

    if (!allPassed) {
      console.error('\nAda rute yang tidak mengembalikan status 200 atau gagal divalidasi!')
      process.exit(1)
    } else {
      console.log('\nSEMUA RUTE BERHASIL STATUS 200 DAN KONTEN TAMPIL DENGAN BAIK!')
    }
  } finally {
    // Kill server process cleanly on Windows
    if (server.pid) {
      try {
        spawn('taskkill', ['/pid', String(server.pid), '/f', '/t'], { shell: true })
      } catch {
        server.kill('SIGTERM')
      }
    }
  }
}

run().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
