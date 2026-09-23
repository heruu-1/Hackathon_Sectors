# Rencana Verifikasi & Kriteria Penerimaan: Evaluasi Sinyal, Risiko, dan Proyeksi Sesi RASI

## 1. Kriteria Penerimaan & Verifikasi Fixture BMRI

Fixture aritmetika BMRI untuk validasi numerik `domain/trade-risk.ts`:
- Input:
  - `entry = 4200`
  - `initialATR = 62.670334`
  - `tick = 10`
  - `buyFee = 0.0015`
  - `sellFee = 0.0025`
  - `stopSlippage = 10`
- Hasil Diharapkan (Toleransi 0):
  - Biaya entry: `4206.30`
  - SL: `4100`
  - Eksekusi stop asumsi: `4090`
  - Risiko bersih per saham: `126.525`
  - TP1 limit: `4380`
  - TP2 limit: `4480`
  - BEP dengan slippage: `4230`
  - Lot untuk modal/kas Rp100 juta dan risiko 0,5%: `39` lot
  - Alokasi lot: `19` lot TP1, `20` lot TP2/sisa
- Sensitivitas 2 tick (`stopSlippage = 20`):
  - Risiko bersih: `136.50`
  - TP1: `4390`
  - TP2: `4500`
  - BEP: `4240`
  - Ukuran posisi: `36` lot

## 2. Pengujian Terfokus Unit Node

Perintah pengujian terfokus:
```powershell
node --experimental-strip-types tests/trading-sessions.test.mjs
node --experimental-strip-types tests/trade-risk.test.mjs
node --experimental-strip-types tests/intraday-provider.test.mjs
node --experimental-strip-types tests/signal-projections.test.mjs
node --experimental-strip-types tests/signal-outcomes.test.mjs
```

## 3. Verifikasi Database & Migrasi
```powershell
node scripts/migrate-signal-analysis.mjs --check
```

## 4. Gates Kualitas Proyek
```powershell
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
git diff --check
```

## 5. Verifikasi UI & Browser
- Tampilan 320px, 768px, 1024px, 1440px.
- Kontras tema gelap & terang.
- State loading, error, data parsial (`INSUFFICIENT_DATA`), dan tersimpan.
- Navigasi antar emiten (BMRI -> BBCA) tidak meninggalkan residual state.

---

## 6. Hasil Eksekusi Verifikasi

### Pengujian Unit Terfokus Node
- `node tests/trading-sessions.test.mjs`: PASSED (5/5)
- `node tests/trade-risk.test.mjs`: PASSED (5/5, verifikasi fixture BMRI exact match)
- `node tests/intraday-provider.test.mjs`: PASSED (5/5)
- `node tests/signal-projections.test.mjs`: PASSED (4/4, Mulberry32 deterministic + GBM touch)
- `node tests/signal-outcomes.test.mjs`: PASSED (10/10)
- **Total Pengujian**: 29 passed, 0 failed.

### Gate Kualitas & Kompilasi
- `corepack pnpm typecheck`: PASSED (exit code 0, 0 error).
- `corepack pnpm build`: PASSED (Next.js 16.3.4 Turbopack production build compiled in 7.6s, 17/17 pages generated).
- `git diff --check`: PASSED (exit code 0, no whitespace errors).
- Verifikasi berkas pengguna di `scratch/`: 4 berkas utuh tanpa perubahan.
- Verifikasi `.env.local`: Utuh tanpa modifikasi.
