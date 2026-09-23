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

### Matriks Baseline: Temuan P0/P1 → Tes Reproduksi → Perubahan → Bukti

| ID Temuan | Severity | Deskripsi Masalah                                                                  | File / Modul                                                  | Rencana Tes Reproduksi                                         | Rencana Perbaikan                                                                  | Status          |
| --------- | -------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------- |
| P0-1      | Blocker  | Format & Lint CI Gate gagal                                                        | `app/broker/page.tsx`, `BrokerActivityExplorer.tsx`, 49 files | `pnpm run format:check`, `pnpm exec eslint . --max-warnings=0` | Refactor impure Date.now, refactor setState effect, format codebase                | Teridentifikasi |
| P0-2      | Critical | Runner migrasi terpisah, catch-and-continue, tanpa ledger checksum & advisory lock | `scripts/migrate*.mjs`, `drizzle/`                            | `tests/migrations.test.mjs`                                    | Unified ordered runner dengan ledger SHA-256 dan advisory lock                     | Teridentifikasi |
| P0-3      | Critical | Fallback user data in-memory saat DB down (fail-open) & `guest-user` shared state  | `conversations.ts`, `quota.ts`, `api/assistant`               | `tests/auth-isolation-failclosed.test.mjs`                     | Hapus fallback in-memory di prod, 401 unauthenticated, return DATABASE_UNAVAILABLE | Teridentifikasi |
| P0-4      | High     | Open redirect pada parameter login `callbackURL`                                   | `app/masuk/page.tsx`                                          | `tests/security-redirect.test.mjs`                             | Sanitasi internal-path-only helper                                                 | Teridentifikasi |
| P0-5      | High     | Kalender BEI 2026 kurang 4 hari libur resmi KSEI/BEI                               | `idx-calendar-2026.json`, `trading-sessions.ts`               | `tests/calendar-2026-comprehensive.test.mjs`                   | Tambahkan 18 Mar, 15 Mei, 28 Mei, 24 Des + nomor pengumuman KSEI                   | Teridentifikasi |
| P0-6      | High     | Simulasi sinyal: multiplier sensitivitas buatan & state machine multi-trigger      | `domain/signal-projections.ts`                                | `tests/signal-projections-statemachine.test.mjs`               | Rerun dengan seed tetap, state hitTP1/hitTP2/position active eksplisit             | Teridentifikasi |
| P0-7      | Medium   | Tindakan & komponen raksasa monolitik                                              | `app/actions.ts`, `components/StockDetail.tsx`                | `tsc`, test suites                                             | Pisahkan ke modul fitur & sub-komponen tab terisolasi                              | Teridentifikasi |
| P0-8      | Medium   | Tidak ada pemisahan endpoint liveness dan readiness                                | `/api/live`, `/api/health`                                    | HTTP probe test                                                | Implementasikan `/api/live` (process) dan `/api/health` (DB + ledger)              | Teridentifikasi |

---

## 2. Catatan Eksekusi Bertahap (Akan Diperbarui per Commit)

_(Bagian ini akan mencatat riwayat command, commit hash, dan exit code per commit.)_
