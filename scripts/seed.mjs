import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

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

const connectionString = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL belum diatur.')
  process.exit(1)
}

const sanitizedUrl = connectionString.replace(/:([^:@]+)@/, ':****@')
console.log(`🌱 Menjalankan seed data ke: ${sanitizedUrl}`)

const sql = postgres(connectionString, {
  max: 1,
  prepare: false,
  connect_timeout: 10,
})

function createSampleSnapshot({
  id,
  ticker,
  companyName,
  price,
  priceChangeFraction,
  priceDate,
  compositeScore,
  compositeStatus,
  fundamentalStatus,
  bandarStatus,
  divergenceStatus,
  insiderStatus,
}) {
  const now = new Date().toISOString()
  const snapshot = {
    id: id || crypto.randomUUID(),
    ticker,
    companyName,
    createdAt: now,
    schemaVersion: '1.0.0',
    ruleVersion: '1.0.0',
    price,
    priceChangeFraction,
    priceDate,
    envelopes: {
      valuation: { state: 'ready', fetchedAt: now, source: 'Sectors API' },
      daily: { state: 'ready', fetchedAt: now, source: 'Sectors API' },
      broker: { state: 'ready', fetchedAt: now, source: 'Sectors API' },
      news: { state: 'ready', fetchedAt: now, source: 'Sectors API' },
      filings: { state: 'ready', fetchedAt: now, source: 'Sectors API' },
    },
    indicators: {
      fundamental: {
        dataState: 'ready',
        pe: 22.4,
        pb: 4.8,
        year: 2026,
        riskScore: 25,
        status: fundamentalStatus || 'NORMAL',
        reason: 'Valuasi dan pertumbuhan laba stabil.',
      },
      bandarmology: {
        dataState: 'ready',
        status: bandarStatus || 'BIG_ACCUMULATION',
        bandarScore: 85,
        cr3Buy: 0.62,
        cr5Buy: 0.78,
        cr3Sell: 0.35,
        cr5Sell: 0.48,
        topBuyers: [
          {
            code: 'CC',
            name: 'Mandiri Sekuritas',
            isForeign: false,
            cohort: 'INSTITUTION',
            lot: 120000,
            value: 122400000000,
            avgPrice: price,
            netValue: 122400000000,
          },
          {
            code: 'ZP',
            name: 'Maybank Sekuritas',
            isForeign: true,
            cohort: 'FOREIGN',
            lot: 95000,
            value: 96900000000,
            avgPrice: price,
            netValue: 96900000000,
          },
        ],
        topSellers: [
          {
            code: 'YP',
            name: 'Mirae Asset Sekuritas',
            isForeign: false,
            cohort: 'RETAIL',
            lot: 45000,
            value: 45900000000,
            avgPrice: price,
            netValue: -45900000000,
          },
        ],
        foreignBuyVal: 150000000000,
        foreignSellVal: 40000000000,
        netForeignVal: 110000000000,
        foreignFlowStatus: 'HEAVY_INFLOW',
        bandarAvgPrice: price,
        currentPrice: price,
        flowSummary: 'Akumulasi dominan oleh institusi dan investor asing.',
        date: priceDate,
      },
      volume: {
        dataState: 'ready',
        spikeRatio: 2.1,
        formattedRatio: '2.10x',
        status: 'HIGH',
        todayVolume: 25000000,
        avgVolume: 11904761,
        observationCount: 21,
        dateRange: { start: '2026-02-20', end: priceDate },
      },
      divergence: {
        dataState: 'ready',
        status: divergenceStatus || 'SLEEPING_GIANT',
        divergenceScore: 82,
        priceChangePct: priceChangeFraction ? priceChangeFraction * 100 : 1.25,
        headline: 'Pertumbuhan laba dan ekspansi kredit melampaui ekspektasi konsensus.',
        impactScore: 80,
        sentiment: 'BULLISH',
        catalystType: 'EARNINGS_GROWTH',
        verdict: 'Katalis fundamental positif dengan potensi respon harga bertahap.',
        recommendation: 'Akumulasi bertahap pada area support.',
        newsTimestamp: now,
      },
      insider: {
        dataState: 'ready',
        hasInsiderActivity: true,
        status: insiderStatus || 'AGGRESSIVE_BUY',
        insiderRiskScore: 15,
        latestFiling: {
          holderName: 'Direksi Utama',
          holderType: 'DIRECTOR',
          action: 'BUY',
          amountShares: 500000,
          transactionPrice: price,
          totalValueIdr: 500000 * price,
          pctChanged: 0.05,
          date: priceDate,
          notes: 'Pembelian langsung untuk kepemilikan pribadi.',
        },
        filingsCount: 3,
        summary: 'Direksi aktif melakukan pembelian saham secara bertahap.',
      },
    },
    composite: {
      score: compositeScore || 82,
      status: compositeStatus || 'HIGH',
      reason: 'Empat pilar lengkap: akumulasi kuat dan katalis fundamental terkonfirmasi.',
      weights: { fundamental: 0.25, broker: 0.35, divergence: 0.25, insider: 0.15 },
      ruleVersion: '1.0.0',
      componentsComplete: true,
      pillarScores: {
        fundamental: 80,
        broker: 85,
        divergence: 82,
        insider: 80,
      },
    },
    provenance: {
      newsAnalysis: 'GEMINI',
      model: 'gemini-2.5-flash',
    },
  }

  return snapshot
}

const samples = [
  createSampleSnapshot({
    id: '00000000-0000-4000-8000-000000000001',
    ticker: 'BBCA',
    companyName: 'Bank Central Asia Tbk',
    price: 10200,
    priceChangeFraction: 0.0125,
    priceDate: '2026-03-20',
    compositeScore: 84,
    compositeStatus: 'HIGH',
    fundamentalStatus: 'NORMAL',
    bandarStatus: 'BIG_ACCUMULATION',
    divergenceStatus: 'SLEEPING_GIANT',
    insiderStatus: 'AGGRESSIVE_BUY',
  }),
  createSampleSnapshot({
    id: '00000000-0000-4000-8000-000000000002',
    ticker: 'TLKM',
    companyName: 'Telkom Indonesia Tbk',
    price: 3850,
    priceChangeFraction: -0.0052,
    priceDate: '2026-03-20',
    compositeScore: 74,
    compositeStatus: 'NORMAL',
    fundamentalStatus: 'NORMAL',
    bandarStatus: 'NEUTRAL',
    divergenceStatus: 'NORMAL_REACTION',
    insiderStatus: 'ROUTINE_TRANSACTION',
  }),
  createSampleSnapshot({
    id: '00000000-0000-4000-8000-000000000003',
    ticker: 'ASII',
    companyName: 'Astra International Tbk',
    price: 5100,
    priceChangeFraction: 0.02,
    priceDate: '2026-03-20',
    compositeScore: 80,
    compositeStatus: 'HIGH',
    fundamentalStatus: 'NORMAL',
    bandarStatus: 'BIG_ACCUMULATION',
    divergenceStatus: 'SLEEPING_GIANT',
    insiderStatus: 'AGGRESSIVE_BUY',
  }),
  createSampleSnapshot({
    id: '00000000-0000-4000-8000-000000000004',
    ticker: 'BBRI',
    companyName: 'Bank Rakyat Indonesia Tbk',
    price: 4950,
    priceChangeFraction: 0.008,
    priceDate: '2026-03-20',
    compositeScore: 78,
    compositeStatus: 'HIGH',
    fundamentalStatus: 'NORMAL',
    bandarStatus: 'NORMAL_ACCUMULATION',
    divergenceStatus: 'NORMAL_REACTION',
    insiderStatus: 'ROUTINE_TRANSACTION',
  }),
]

try {
  // Ensure tables exist
  const tableCheck = await sql`
    SELECT to_regclass('public.analysis_snapshots') as table_name
  `
  if (!tableCheck[0]?.table_name) {
    console.log('⚠️ Tabel analysis_snapshots belum ada. Menjalankan migrasi terlebih dahulu...')
    const migrationFile = path.join(rootDir, 'drizzle', '0002_rasi_v2_clean.sql')
    if (fs.existsSync(migrationFile)) {
      const sqlContent = fs.readFileSync(migrationFile, 'utf-8')
      await sql.unsafe(sqlContent)
      console.log('✅ Migrasi otomatis selesai.')
    } else {
      console.error('❌ File migrasi tidak ditemukan.')
      process.exit(1)
    }
  }

  for (const snapshot of samples) {
    await sql`
      INSERT INTO analysis_snapshots (
        id,
        ticker,
        company_name,
        schema_version,
        rule_version,
        price,
        price_change_fraction,
        price_date,
        payload,
        created_at
      ) VALUES (
        ${snapshot.id},
        ${snapshot.ticker},
        ${snapshot.companyName},
        ${snapshot.schemaVersion},
        ${snapshot.ruleVersion},
        ${snapshot.price},
        ${snapshot.priceChangeFraction},
        ${snapshot.priceDate},
        ${JSON.stringify(snapshot)},
        ${new Date(snapshot.createdAt)}
      )
      ON CONFLICT (id) DO UPDATE SET
        ticker = EXCLUDED.ticker,
        company_name = EXCLUDED.company_name,
        price = EXCLUDED.price,
        price_change_fraction = EXCLUDED.price_change_fraction,
        price_date = EXCLUDED.price_date,
        payload = EXCLUDED.payload,
        created_at = EXCLUDED.created_at
    `
    console.log(
      `  ✓ Snapshot untuk ${snapshot.ticker} (${snapshot.companyName}) berhasil disimpan.`,
    )
  }

  console.log('✅ Seeding database selesai dengan sukses!')
  await sql.end()
  process.exit(0)
} catch (error) {
  console.error('❌ Terjadi kesalahan saat seeding data:', error)
  await sql.end()
  process.exit(1)
}
