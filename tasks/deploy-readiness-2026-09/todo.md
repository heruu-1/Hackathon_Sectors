# Checklist Kesiapan Deploy RASI (Deploy Readiness 2026-09)

## Tahap A — Kunci baseline dan pulihkan CI

- [x] A1. Dokumentasikan baseline (HEAD `78fcbe8`, 23 commit, 5 workflow gagal, P0/P1 matrix, tandai checklist lama kadaluwarsa) — _Selesai di Commit 1 (`c818aa3`)_
- [x] A2. Perbaiki format dan lint (`Date.now()` di `app/broker/page.tsx`, `setState` di `BrokerActivityExplorer.tsx`, variabel mati, `max-warnings=0`) — _Selesai di Commit 2 (`eb44ff3`)_
- [x] A3. Perbaiki workflow CI (Node 22, pnpm@10.33.0, frozen lockfile, PostgreSQL disposable, urutan gate ketat) — _Selesai di Commit 3 (`ec7e9c1`)_

## Tahap B — Migrasi database yang aman dan deterministik

- [x] B1. Satukan runner migrasi (`DATABASE_MIGRATION_URL`, urutan `0002` -> `0003` -> `0004`, ledger SHA-256 `_rasi_migrations`, advisory lock, atomic transactions, `--check` mode) — _Selesai di Commit 4 (`b2f7bf7`)_
- [x] B2. Tambahkan verifikasi schema dan pengujian migrasi (fresh install, upgrade, idempotensi, failure rollback, locked execution di `tests/migrations.test.mjs`) — _Selesai di Commit 4 (`b2f7bf7`)_
- [x] B3. Dokumentasikan strategi produksi & backup drill (documented in verification & playbook) — _Selesai di Commit 4 & 13_

## Tahap C — Konfigurasi dan feature flag yang benar-benar bekerja

- [x] C1. Selaraskan konfigurasi environment, `.env.example`, allowlist model Gemini (`gemini-3.5-flash-lite`), timeout, TTL, simulation limits — _Selesai di Commit 5 (`c3b6d72`)_
- [x] C2. Terapkan flag di batas server (`FEATURE_DISABLED` status, tolak startup bila fitur aktif tanpa kredensial valid) — _Selesai di Commit 5 (`c3b6d72`)_
- [x] C3. Tambahkan script `predeploy.mjs` (7-gate release orchestrator) — _Selesai di Commit 5 (`c3b6d72`)_

## Tahap D — Tutup celah autentikasi, isolasi pengguna, dan privasi

- [x] D1. Hilangkan identitas tamu bersama (hapus `guest-user`, wajib login untuk `/api/assistant`, HTTP 401 unauthenticated) — _Selesai di Commit 6 (`350f37f`)_
- [x] D2. Ubah repository percakapan & kuota menjadi fail-closed (hapus fallback in-memory di prod, tangani `DATABASE_UNAVAILABLE`) — _Selesai di Commit 6 (`350f37f`)_
- [x] D3. Tutup open redirect (normalisasi & sanitasi `callbackURL` di `lib/security/redirect.ts`) — _Selesai di Commit 7 (`a2be557`)_
- [x] D4. Keraskan Better Auth (`baseURL`, `trustedOrigins`, cookie secure/httponly/lax) — _Selesai di Commit 7 (`a2be557`)_
- [x] D5. Validasi semua input (Zod schemas) dan sanitasi pesan error publik — _Selesai di Commit 6 & 7_
- [x] D6. Implementasikan CSP, security headers, dan privacy disclosure — _Selesai di Commit 7 (`a2be557`)_

## Tahap E — Perbaiki kebenaran simulasi sinyal

- [x] E1. Definisikan kontrak produk sinyal immutable (`contextId` required, context-ticker match) — _Selesai di Commit 8 (`70b9bad`)_
- [x] E2. Perbaiki kalender BEI/KSEI 2026 (tambahkan 18 Maret, 15 Mei, 28 Mei, 24 Desember, dan nomor pengumuman resmi KSEI) — _Selesai di Commit 8 (`70b9bad`)_
- [x] E3. Bangun timeline simulasi kanonis (potong masa lalu berdasar `asOf`, sesi parsial) — _Selesai di Commit 8 (`70b9bad`)_
- [x] E4. Perbaiki state machine posisi (TP1 alokasi 1x, TP2 alokasi 1x, trailing stop 15m completed close) — _Selesai di Commit 9 (`208aa82`)_
- [x] E5. Sensitivitas dan determinisme nyata (hapus multiplier buatan, rerun dengan random stream identik untuk volatilitas $\pm 25\%$ dan slippage 2-tick) — _Selesai di Commit 9 (`208aa82`)_
- [x] E6. Kualitas data intraday (provenance jujur, hapus 2% heuristic ATR semu, VWAP & RVOL per sesi) — _Selesai di Commit 10 (`e4b0257`)_
- [x] E7. Batas performa sinkron 25.000 path dan caching deterministik — _Selesai di Commit 9 (`208aa82`)_

## Tahap F — Provider, kesehatan sistem, dan kebenaran klaim

- [x] F1. Standarisasi Provider Envelope (`status`, `source`, `observedAt`, `sourceDelayMinutes`, `issues`, `data`) — _Selesai di Commit 10 (`e4b0257`)_
- [x] F2. Pisahkan liveness (`/api/live`) dan readiness (`/api/health`) — _Selesai di Commit 12 (`ee9c371`)_
- [x] F3. Observabilitas dan structured logging dengan sanitasi data pribadi (SHA-256 user id hashing, secret redaction) — _Selesai di Commit 12 (`ee9c371`)_

## Tahap G — Rapikan arsitektur tanpa rewrite besar

- [x] G1. Pecah `app/actions.ts` menurut domain (`market`, `watchlist`, `assistant`, `radar`, `signal`, `history`, `shared`) dengan backward-compatible re-exports — _Selesai di Commit 11 (`e51eb58`)_
- [x] G2. Pecah komponen raksasa `StockDetail.tsx` ke tab-tab modular (`components/stock-detail/`) — _Selesai di Commit 11 (`e51eb58`)_
- [x] G3. Kanonisasi kode duplikat dan klasifikasi aman `scratch/` di `scratch/README.md` — _Selesai di Commit 11 (`e51eb58`)_
