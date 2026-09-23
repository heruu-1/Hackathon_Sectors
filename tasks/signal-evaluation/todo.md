# Todo Checklist: Evaluasi Sinyal, Risiko, dan Proyeksi Sesi RASI

## Tahap 0: Handoff & Setup
- [x] Inisialisasi folder `tasks/signal-evaluation/`
- [x] Dokumen `plan.md` dibuat
- [x] Dokumen `todo.md` dibuat
- [x] Dokumen `verification.md` dibuat
- [x] Verifikasi empat berkas pengguna di `scratch/` tetap aman

## Tahap 1: Kontrak & Kalender Sesi BEI
- [x] Buat `lib/contracts/signal-analysis.ts` dengan Zod schema dan tipe TypeScript
- [x] Buat data hari libur BEI `lib/data/idx-calendar-2026.json`
- [x] Buat modul kalender sesi murni `domain/trading-sessions.ts` (S1/S2, Jumat, batas 15.50 WIB, horizon H1/H3/H5)
- [x] Buat tes kalender sesi `tests/trading-sessions.test.mjs`

## Tahap 2: Provider Intraday (Yahoo 5m)
- [x] Tambahkan `'YAHOO'` ke `DataSource` pada `lib/contracts/market.ts`
- [x] Buat adapter `lib/server/providers/intraday.ts` (timeout 10s, cache 15m, deduplikasi in-flight, filter bar kontinu, metadata delay)
- [x] Tambahkan konfigurasi `SIGNAL_ANALYSIS_ENABLED` dan `INTRADAY_PROVIDER` pada `lib/server/env.ts` dan `env.example`
- [x] Buat tes provider `tests/intraday-provider.test.mjs`

## Tahap 3: Outcome & Indikator Sesi
- [x] Perbarui `domain/signal-outcomes.ts` dengan fungsi evaluasi sesi intraday (`evaluateSessionSignalOutcomes`)
- [x] Buat `domain/signal-indicators.ts` (ATR Wilder 14 beku, EMA-20 harian selesai, VWAP tipikal, RVOL histori setara, stop checks)
- [x] Buat/perbarui tes outcome di `tests/signal-outcomes.test.mjs`

## Tahap 4: Manajemen Risiko Perdagangan
- [x] Buat `domain/trade-risk.ts` (fraksi harga BEI, fee beli 0,15%, fee jual 0,25%, SL, TP1, TP2, BEP, trailing stop, alokasi lot ganjil)
- [x] Buat tes risiko `tests/trade-risk.test.mjs` dan verifikasi fixture aritmetika BMRI

## Tahap 5: Proyeksi Stokastik (GBM Pure TypeScript)
- [x] Buat `domain/signal-projections.ts` (seeded PRNG, kalibrasi volatilitas S1/S2/gap makan siang/gap semalam, GBM 100k paths, probabilitas sentuhan, dynamic strategy, sensitivitas 1m/vol/slippage)
- [x] Buat tes proyeksi `tests/signal-projections.test.mjs`

## Tahap 6: Persistensi & Migrasi Database
- [x] Tambahkan `signal_contexts` dan `signal_analysis_runs` pada `db/schema.ts`
- [x] Buat migrasi SQL `drizzle/0004_signal_analysis.sql`
- [x] Buat script migrasi `scripts/migrate-signal-analysis.mjs` dengan flag `--check`
- [x] Buat repository `lib/server/repositories/signal-analysis.ts`

## Tahap 7: Orkestrasi Backend & Server Actions
- [x] Tambahkan limit kuota `signal_analysis` (2/menit, 20/hari) pada `lib/server/quota.ts`
- [x] Buat service orkestrasi `lib/server/services/signal-analysis.ts`
- [x] Buat Server Actions `getSignalAnalysisAction` & `evaluateSignalAnalysisAction` pada `app/actions.ts`

## Tahap 8: Antarmuka UI (SignalEvaluationPanel)
- [x] Buat subkomponen tabel dan kartu pada `components/signal-evaluation/`
- [x] Buat komponen utama `components/SignalEvaluationPanel.tsx`
- [x] Integrasikan panel baru ke `components/ResearchWorkspace.tsx` dan pertahankan hasil lama sebagai accordion legacy

## Tahap 9: Verifikasi & Audit Kualitas
- [x] Jalankan pengujian unit terfokus Node (5 test suites, 29 tests passed)
- [x] Jalankan `corepack pnpm typecheck` (Passed cleanly, 0 errors)
- [x] Jalankan `corepack pnpm lint` (Checked, fixed warnings in modified files)
- [x] Jalankan `corepack pnpm build` (Next.js 16 Turbopack production build succeeded)
- [x] Jalankan `git diff --check` (0 whitespace errors)
- [x] Verifikasi browser & multi-ticker isolation
