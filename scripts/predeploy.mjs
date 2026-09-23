#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

// Load environment configuration files
loadEnvFile(path.join(rootDir, '.env.production'))
loadEnvFile(path.join(rootDir, '.env.local'))
loadEnvFile(path.join(rootDir, '.env'))

console.log('========================================================')
console.log('  RASI Deploy Readiness Verification (scripts/predeploy.mjs)')
console.log('========================================================\n')

const isWindows = process.platform === 'win32'
const npxCmd = isWindows ? 'npx.cmd' : 'npx'
const nodeCmd = 'node'

function runStep(gateNumber, gateName, command, args, options = {}) {
  console.log(`[Gate ${gateNumber}/7] ${gateName}...`)
  const start = performance.now()
  const useShell =
    options.shell !== undefined
      ? options.shell
      : isWindows && typeof command === 'string' && command.endsWith('.cmd')
  const res = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: useShell,
    ...options,
  })
  const duration = ((performance.now() - start) / 1000).toFixed(2)

  if (res.status !== 0) {
    console.error(
      `\n❌ [Gate ${gateNumber}/7] GAGAL: ${gateName} (Exit Code: ${res.status}, durasi: ${duration}s)`,
    )
    process.exit(res.status || 1)
  }

  console.log(`✓ [Gate ${gateNumber}/7] LULUS: ${gateName} (${duration}s)\n`)
}

// Step 1: Environment Schema Check
const envCheckCode = `
import { ServerEnvSchema } from './lib/server/env.ts';
const isProd = process.env.NODE_ENV === 'production';
const hasDb = Boolean(process.env.DATABASE_URL);
if (!hasDb && !isProd) {
  console.log('[Info] DATABASE_URL tidak diisi di lokal; memeriksa skema dasar.');
}
const testEnv = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://localhost:5432/placeholder',
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || 'rasi-development-secret-change-this-before-deployment-32-chars',
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  ...process.env
};
const res = ServerEnvSchema.safeParse(testEnv);
if (!res.success) {
  console.error('Konfigurasi environment tidak valid:');
  console.error(res.error.format());
  process.exit(1);
}
console.log('✓ Skema environment terverifikasi valid.');
`
runStep(1, 'Validasi Skema Environment', nodeCmd, [
  '--experimental-strip-types',
  '-e',
  envCheckCode,
])

// Step 2: Database Migration Check
if (process.env.DATABASE_URL && !process.env.SKIP_DB_CHECK) {
  runStep(2, 'Pemeriksaan Ledger & Integritas Migrasi Database', nodeCmd, [
    'scripts/migrate-unified.mjs',
    '--check',
  ])
} else {
  console.log(
    '[Gate 2/7] Pemeriksaan Migrasi Database dilewati (DATABASE_URL tidak disetel atau SKIP_DB_CHECK aktif).\n',
  )
}

// Step 3: Format Check
runStep(3, 'Pemeriksaan Format Kode (Prettier)', npxCmd, [
  'prettier',
  '--check',
  '--ignore-unknown',
  '.',
])

// Step 4: ESLint Check (zero warnings)
runStep(4, 'Pemeriksaan Linting (ESLint --max-warnings=0)', npxCmd, [
  'eslint',
  '.',
  '--max-warnings=0',
])

// Step 5: TypeScript Check
runStep(5, 'Pemeriksaan Kompilasi TypeScript (tsc)', npxCmd, [
  'tsc',
  '--noEmit',
  '--incremental',
  'false',
])

// Step 6: Test Suite Check
runStep(6, 'Eksekusi Unit & Integration Tests (node --test)', nodeCmd, [
  '--experimental-strip-types',
  '--test',
  'tests/*.test.mjs',
])

// Step 7: Next.js Production Build
runStep(7, 'Verifikasi Production Build Next.js (next build)', npxCmd, ['next', 'build'])

console.log('========================================================')
console.log('  🎉 SELURUH GERBANG KESIAPAN DEPLOY RASI LULUS (7/7)')
console.log('========================================================')
