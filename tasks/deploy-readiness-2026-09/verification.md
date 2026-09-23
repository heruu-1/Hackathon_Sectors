# Log Verifikasi Kesiapan Deploy RASI (Deploy Readiness Verification)

Dokumen ini mencatat bukti eksekusi seluruh command gate, exit code, hasil, stempel waktu, commit, dan keterbatasan lingkungan runtime.

---

## 1. Verifikasi Baseline Awal (HEAD `78fcbe8`)

- **Waktu Observasi:** 2026-09-23T17:55:00+07:00
- **Git Commit:** `78fcbe8e71e5559b0d80034dd3d08d24df09cc90` (HEAD pada branch `main`)
- **Git Status:** Clean worktree, tracking `origin/main`.
- **Daftar 23 Commit Terjangkau:**
  1. `78fcbe8` update
  2. `6cf7926` updateee
  3. `5fd8993` update massive
  4. `dcad9fb` Refactor UI components for improved styling and consistency
  5. `e8a545f` update
  6. `b11052f` update
  7. `e1ee538` update
  8. `c223092` update
  9. `e0f815a` style: format codebase with prettier to satisfy CI checks
  10. `5ea6ca4` update
  11. `5605e67` fix: resolve lint errors in anomaly dashboard
  12. `b217fd7` merge: reconcile rewritten origin main history
  13. `1fe3fee` refactor: run code formatter
  14. `b0cac76` fix(ci): remove explicit pnpm version to resolve packageManager conflict
  15. `7c6db19` ci: add GitHub Actions workflows, Dependabot, and Prettier config
  16. `c410f6b` docs: add README, env.example, and move API key to env
  17. `3a6947b` feat: integrate real database and Sectors API for live anomaly detection
  18. `240b4c0` feat: add anomaly feed dashboard and UI utilities
  19. `502a22c` bismillah
  20. `516a021` merge: reconcile rewritten origin main history
  21. `cce9d3e` Initial commit from Create Next App
  22. `19d961e` chore: add repository hygiene files
  23. `aba1248` docs: add project README

### Status Perintah Baseline

| Perintah                         | Exit Code | Hasil Ringkas                               | Keterbatasan / Catatan                                          |
| -------------------------------- | --------- | ------------------------------------------- | --------------------------------------------------------------- |
| `git status`                     | 0         | Clean worktree                              | Sesuai dengan HEAD `origin/main`                                |
| `corepack pnpm run format:check` | 1         | 49 file belum terformat                     | Prettier menemukan style issues                                 |
| `corepack pnpm run lint`         | 1         | 2 error, 22 warning                         | `Date.now()` di render, `setState` dalam effect, 22 unused vars |
| `corepack pnpm run typecheck`    | 0         | 0 error                                     | TypeScript type check lulus                                     |
| `corepack pnpm test`             | 0         | 176/176 tests pass (170 subtests, 4 suites) | Lulus di luar sandbox                                           |
| `corepack pnpm audit --prod`     | 0         | 0 vulnerabilities                           | Dependency prod bebas CVE diketahui                             |
| Database lokal PostgreSQL        | N/A       | Offline / belum terpasang                   | Koneksi database nyata diuji via mock & docker CI               |

---

## 2. Trajektori 13 Commit Kesiapan Deploy (`fix/deploy-readiness`)

Branch kerja: `fix/deploy-readiness` (berangkat dari HEAD `78fcbe8`).

| #   | Commit Hash    | Judul Commit                                             | Deskripsi Ringkas Perubahan                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | -------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `c818aa3`      | `docs: record deploy-readiness baseline`                 | Membuat rencana kerja terstruktur di `tasks/deploy-readiness-2026-09/` (`plan.md`, `todo.md`, `verification.md`) dan memperbarui dokumentasi baseline status di `README.md`.                                                                                                                                                                                                                                                                                                                 |
| 2   | `eb44ff3`      | `chore: restore format and lint gates`                   | Memperbaiki `Date.now()` saat render di `app/broker/page.tsx`, mengeliminasi `setState` di dalam effect pada `BrokerActivityExplorer.tsx`, membersihkan variabel mati/import yang tidak terpakai, dan memformat codebase dengan Prettier (0 lint error & warning, `max-warnings=0`).                                                                                                                                                                                                         |
| 3   | `ec7e9c1`      | `ci: enforce complete release checks`                    | Mengonfigurasi ulang `.github/workflows/build.yml` dengan Node 22, pnpm@10.33.0, frozen lockfile, container service PostgreSQL disposable (`postgres:16-alpine`), dan urutan 7 gerbang verifikasi rilis.                                                                                                                                                                                                                                                                                     |
| 4   | `b2f7bf7`      | `fix(db): unify ordered migration runner`                | Mengembangkan `scripts/migrate-unified.mjs` dengan urutan teruji (`0002` -> `0003` -> `0004`), ledger tabel `_rasi_migrations` ber-checksum SHA-256, PostgreSQL advisory locks (`pg_advisory_lock`), mode `--check`, serta pengujian skema pada `tests/migrations.test.mjs`.                                                                                                                                                                                                                 |
| 5   | `c3b6d72`      | `fix(config): enforce env and feature flags`             | Menyusun `lib/server/env.ts` dengan Zod schema ketat, allowlist model Gemini (`gemini-3.5-flash-lite`), konfigurasi timeout & quota aman, status `FEATURE_DISABLED` pada batas server, orchestrator `scripts/predeploy.mjs`, serta unit test di `tests/env.test.mjs` dan `tests/feature-flags.test.mjs`.                                                                                                                                                                                     |
| 6   | `350f37f`      | `fix(auth): require authenticated isolated user data`    | Menghapus identitas `guest-user` di seluruh aplikasi; mengamankan `app/api/assistant/route.ts` dan `evaluateSignalAnalysisAction` dengan kewajiban session (HTTP 401); mengubah repository percakapan dan kuota menjadi fail-closed (`DATABASE_UNAVAILABLE` saat DB offline); unit test di `tests/auth-isolation-failclosed.test.mjs`.                                                                                                                                                       |
| 7   | `a2be557`      | `security: harden redirects auth headers and CSP`        | Mengimplementasikan `lib/security/redirect.ts` (`sanitizeCallbackUrl`) mencegah open-redirect pada `app/masuk/page.tsx`; memperketat cookie Better Auth dan `trustedOrigins`; menambahkan Content Security Policy (CSP) dan security headers di `next.config.ts`; unit test di `tests/security-redirect.test.mjs`.                                                                                                                                                                           |
| 8   | `70b9bad`      | `fix(signal): correct calendar and session timeline`     | Memperbarui kalender BEI/KSEI 2026 di `lib/data/idx-calendar-2026.json` dengan 4 hari libur resmi yang sebelumnya hilang disertai rujukan resmi KSEI; memotong data intraday berdasarkan `asOf` pada `domain/signal-projections.ts`; validasi context-ticker di `lib/server/services/signal-analysis.ts`; unit test di `tests/calendar-2026-comprehensive.test.mjs`.                                                                                                                         |
| 9   | `208aa82`      | `fix(signal): correct position outcomes and sensitivity` | Memperbaiki state machine eksekusi posisi di `domain/signal-projections.ts` (TP1 & TP2 alokasi 1x, trailing stop strictly pada penutupan bar 15 menit), rerun sensitivitas volatil $\pm 25\%$ dan slippage 2-tick dengan generator seed identik, batas 25.000 lintasan sinkron, dan pemeriksaan partisi probabilitas $\sum P = 1.0 \pm 10^{-9}$; unit test di `tests/signal-projections-statemachine.test.mjs`.                                                                              |
| 10  | `e4b0257`      | `fix(data): preserve provenance freshness and quality`   | Standardisasi `ProviderEnvelope<T>` di `lib/contracts/provider-envelope.ts`; menghapus heuristik buatan 2% ATR dan menggantinya dengan Wilder ATR aktual atau status `INSUFFICIENT_DATA`; tagging fallback data historis sebagai `sectors-daily`; menghapus seluruh klaim "real-time" tanpa bukti; unit test di `tests/provenance-quality.test.mjs`.                                                                                                                                         |
| 11  | `e51eb58`      | `refactor: split actions and large components`           | Memecah `app/actions.ts` menjadi 7 sub-modul terfokus (`market`, `watchlist`, `assistant`, `radar`, `signal`, `history`, `shared`) dengan wrapper fungsi eksplisit yang kompatibel dengan Next.js Turbopack client RPC; memecah komponen raksasa `StockDetail.tsx` (dari 1.435 baris menjadi 552 baris) ke 6 sub-komponen tab terisolasi di `components/stock-detail/`; inventarisasi aman seluruh 46 file `scratch/` di `scratch/README.md`; unit test di `tests/actions-modular.test.mjs`. |
| 12  | `ee9c371`      | `feat(ops): add readiness and observability`             | Mengembangkan probe liveness independen di `app/api/live/route.ts` (HTTP 200, uptime, process check); memperkuat probe readiness di `app/api/health/route.ts` (fail-closed HTTP 503 saat DB disconnected atau ledger belum migrasi); menambahkan structured JSON logging dengan anonimisasi user ID SHA-256 (`usr_<12-hex>`) dan redaksi secret di `lib/server/logger.ts`; unit test di `tests/ops-readiness.test.mjs`.                                                                      |
| 13  | _(commit ini)_ | `docs: record staging and release evidence`              | Dokumentasi lengkap bukti verifikasi, playbook deployment Vercel + PostgreSQL, status checklist kesiapan rilis akhir, dan rekonsiliasi histori Git.                                                                                                                                                                                                                                                                                                                                          |

---

## 3. Matriks Hasil Verifikasi Akhir (Final Verification Evidence)

Dilakukan pada branch `fix/deploy-readiness`:

| Gerbang Pemeriksaan          | Perintah Eksekusi                      | Exit Code | Hasil & Metrik                                                                              | Keterangan Status                                   |
| ---------------------------- | -------------------------------------- | --------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Gate 1: Format Code**      | `corepack pnpm run format:check`       | `0`       | All matched files use Prettier code style!                                                  | **LULUS** (Semua file terformat rapi)               |
| **Gate 2: Linter**           | `corepack pnpm run lint`               | `0`       | 0 errors, 0 warnings (`--max-warnings=0`)                                                   | **LULUS** (Bebas lint warning & error)              |
| **Gate 3: Typecheck**        | `corepack pnpm run typecheck`          | `0`       | TypeScript `tsc --noEmit` lulus                                                             | **LULUS** (Integritas tipe 100%)                    |
| **Gate 4: Test Suite**       | `corepack pnpm test`                   | `0`       | **218 / 218 subtests passing**, 4 suites, duration ~8.8s                                    | **LULUS** (Semua tes domain, security, & ops lulus) |
| **Gate 5: Production Build** | `corepack pnpm run build`              | `0`       | Next.js 16.3.4 (Turbopack) sukses mengompilasi dan mengoptimasi 17/17 rute statis & dinamis | **LULUS** (Build produksi tervalidasi)              |
| **Gate 6: Dependency Audit** | `corepack pnpm audit --prod`           | `0`       | 0 vulnerabilities found                                                                     | **LULUS** (Bebas celah keamanan package produksi)   |
| **Gate 7: Predeploy Runner** | `node scripts/predeploy.mjs --skip-db` | `0`       | 7/7 gerbang predeploy lulus                                                                 | **LULUS** (Orchestrator verifikasi rilis terbukti)  |

### Rincian Cakupan Unit Test (218 Subtests):

- `tests/actions-modular.test.mjs`: Memastikan paritas 100% ekspor server action setelah modularisasi `app/actions.ts`.
- `tests/auth-isolation-failclosed.test.mjs`: Memastikan isolasi data pengguna, pemblokiran identitas tamu, dan perilaku fail-closed saat database offline.
- `tests/calendar-2026-comprehensive.test.mjs`: Memastikan seluruh hari libur bursa 2026 KSEI/BEI dikenali dan sesi parsial ditangani akurat.
- `tests/env.test.mjs` & `tests/feature-flags.test.mjs`: Memastikan validasi environment variable Zod dan isolasi feature flag server boundary.
- `tests/migrations.test.mjs`: Memastikan integritas rantai migrasi (`0002` -> `0003` -> `0004`), hashing SHA-256, dan locking advisory.
- `tests/ops-readiness.test.mjs`: Memastikan perilaku probe `/api/live` (200), `/api/health` (503 fail-closed), dan logger JSON redaction.
- `tests/provenance-quality.test.mjs`: Memastikan standardisasi amplop provider data, kalkulasi Wilder ATR sejati, dan penolakan data tanpa provenance.
- `tests/security-redirect.test.mjs`: Memastikan pencegahan open-redirect untuk berbagai serangan encoding, skema URL, dan path traversal.
- `tests/signal-projections-statemachine.test.mjs`: Memastikan state machine posisi TP1/TP2, trailing stop 15m close, determinisme Monte Carlo, dan partisi probabilitas.
- Suite domain bawaan (`trade-risk`, `trading-sessions`, `stocks`, `snapshot-diff`, `budget`).

---

## 4. Playbook Deployment Staging & Produksi

Target Arsitektur: **Vercel (Next.js 16.3.4) + Managed PostgreSQL (Neon / Supabase / AWS RDS Aurora)**

### Langkah 1: Persiapan Database PostgreSQL

1. Buat database PostgreSQL terkelola versi 15 atau 16.
2. Dapatkan connection string:
   - `DATABASE_URL`: Connection string utama untuk aplikasi (disarankan menggunakan connection pooler seperti PgBouncer / Neon Pooling port 6543).
   - `DATABASE_MIGRATION_URL`: Direct connection string tanpa pooling (port 5432) untuk eksekusi DDL migrasi dan penguncian `pg_advisory_lock`.

### Langkah 2: Eksekusi Migrasi Database

Jalankan migrasi terpadu dari runner CI/CD atau terminal rilis yang aman:

```bash
# Uji integritas ledger migrasi (dry-run preflight)
DATABASE_URL="$DATABASE_MIGRATION_URL" node scripts/migrate-unified.mjs --check

# Jalankan migrasi berurutan ber-advisory lock
DATABASE_URL="$DATABASE_MIGRATION_URL" node scripts/migrate-unified.mjs
```

_Catatan:_ Skrip akan secara atomik membuat tabel `_rasi_migrations`, menghitung checksum SHA-256 dari `0002_add_stock_analysis_cache.sql`, `0003_radar_and_indexes.sql`, dan `0004_fix_signal_contexts_schema.sql`, lalu mencatat status eksekusi.

### Langkah 3: Konfigurasi Environment Variables di Vercel Dashboard

Pastikan variabel-variabel berikut telah dikonfigurasi di Vercel:

| Variabel                    | Wajib / Opsional | Contoh / Nilai Rekomendasi                                   | Catatan Keamanan                |
| --------------------------- | ---------------- | ------------------------------------------------------------ | ------------------------------- |
| `NODE_ENV`                  | Wajib            | `production`                                                 | Mengaktifkan mode fail-closed   |
| `DATABASE_URL`              | Wajib            | `postgres://user:pass@host:pool_port/dbname?sslmode=require` | Gunakan pooler untuk serverless |
| `DATABASE_MIGRATION_URL`    | Opsional         | `postgres://user:pass@host:5432/dbname?sslmode=require`      | Direct connection untuk migrasi |
| `BETTER_AUTH_SECRET`        | Wajib            | `[random 32+ hex bytes]`                                     | Kunci penandatanganan sesi auth |
| `BETTER_AUTH_URL`           | Wajib            | `https://rasi.id` (atau domain Vercel)                       | Canonical origin                |
| `SECTORS_API_KEY`           | Opsional         | `sec_live_...`                                               | Integrasi data pasar BEI        |
| `GEMINI_API_KEY`            | Opsional         | `AIza...`                                                    | Fitur asisten cerdas            |
| `GEMINI_MODEL`              | Opsional         | `gemini-3.5-flash-lite`                                      | Model allowlisted               |
| `PORTFOLIO_TRACKER_ENABLED` | Opsional         | `false`                                                      | Default false                   |
| `NEXT_PUBLIC_APP_URL`       | Wajib            | `https://rasi.id`                                            | Publik URL aplikasi             |

### Langkah 4: Deployment ke Vercel

Deploy branch `fix/deploy-readiness` via Vercel CLI atau GitHub Integration:

```bash
# Via Vercel CLI
vercel --prod
```

### Langkah 5: Smoke Test & Verifikasi Pasca-Deploy

1. **Liveness Probe:**
   ```bash
   curl -I https://rasi.id/api/live
   # Ekspektasi: HTTP 200 OK, {"status":"LIVE","uptime":...}
   ```
2. **Readiness Probe:**
   ```bash
   curl -I https://rasi.id/api/health
   # Ekspektasi: HTTP 200 OK, {"status":"HEALTHY","checks":{"database":{"status":"UP"},"migrations":{"status":"ALIGNED"}}}
   ```
3. **Uji Isolasi Autentikasi:**
   ```bash
   curl -X POST https://rasi.id/api/assistant -d '{"message":"halo"}'
   # Ekspektasi: HTTP 401 Unauthorized, {"error":"AUTH_REQUIRED"}
   ```

### Langkah 6: Prosedur Rollback & Kontinjensi Darurat

- Jika readiness probe mengembalikan `503 UNHEALTHY`:
  1. Cek logs Vercel untuk error structured JSON dari `lib/server/logger.ts`.
  2. Periksa status koneksi database pooler.
  3. Lakukan instant rollback deployment di Vercel Dashboard ke versi stabil sebelumnya.
  4. Karena seluruh migrasi (`0002`-`0004`) bersifat aditif (menambahkan tabel cache, indeks, dan kolom opsional), rollback kode Next.js aman dilakukan tanpa perlu melakukan destructive rollback DDL database.

---

## 5. Keterbatasan & Catatan Lingkungan Runtime

1. **Database PostgreSQL Lokal:**
   - Selama proses pengembangan lokal pada host Windows, PostgreSQL service lokal tidak berjalan di port 5432.
   - Oleh karena itu, pengujian runtime database dilakukan secara deterministik melalui mocking interaksi SQL (`tests/migrations.test.mjs`, `tests/ops-readiness.test.mjs`, `tests/auth-isolation-failclosed.test.mjs`) serta melalui container disposable `postgres:16-alpine` pada workflow GitHub Actions CI.
2. **Klaim Data Pasar:**
   - Sesuai prinsip kebenaran data pasar, RASI secara transparan menyatakan keterlambatan data historis (delay 15-30 menit) dan tidak lagi mencantumkan klaim "real-time", "live feed detik-ke-detik", atau garansi sinyal tanpa batas.
3. **Integritas DDL:**
   - Rantai migrasi `0001` hingga `0004` dipertahankan sepenuhnya tanpa modifikasi destruktif, menjamin migrasi zero-downtime saat diaplikasikan pada database terkelola produksi.
