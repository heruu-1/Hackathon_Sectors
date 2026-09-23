# Checklist Kesiapan Deploy RASI (Deploy Readiness 2026-09)

## Tahap A — Kunci baseline dan pulihkan CI

- [ ] A1. Dokumentasikan baseline (HEAD `78fcbe8`, 23 commit, 5 workflow gagal, P0/P1 matrix, tandai checklist lama kadaluwarsa)
- [ ] A2. Perbaiki format dan lint (`Date.now()` di `app/broker/page.tsx`, `setState` di `BrokerActivityExplorer.tsx`, variabel mati, `max-warnings=0`)
- [ ] A3. Perbaiki workflow CI (Node 22, pnpm@10.33.0, frozen lockfile, PostgreSQL disposable, urutan gate ketat)

## Tahap B — Migrasi database yang aman dan deterministik

- [ ] B1. Satukan runner migrasi (`DATABASE_MIGRATION_URL`, urutan `0002` -> `0003` -> `0004`, ledger SHA-256, advisory lock, atomic transactions, `--check` mode)
- [ ] B2. Tambahkan verifikasi schema dan pengujian migrasi (fresh install, upgrade, idempotensi, failure rollback, locked execution)
- [ ] B3. Dokumentasikan strategi produksi & backup drill

## Tahap C — Konfigurasi dan feature flag yang benar-benar bekerja

- [ ] C1. Selaraskan konfigurasi environment, `.env.example`, allowlist model Gemini (`gemini-3.5-flash-lite`), timeout, TTL, simulation limits
- [ ] C2. Terapkan flag di batas server (`FEATURE_DISABLED` status, tolak startup bila fitur aktif tanpa kredensial valid)
- [ ] C3. Tambahkan script `predeploy.mjs`

## Tahap D — Tutup celah autentikasi, isolasi pengguna, dan privasi

- [ ] D1. Hilangkan identitas tamu bersama (hapus `guest-user`, wajib login untuk `/api/assistant`, HTTP 401 unauthenticated)
- [ ] D2. Ubah repository percakapan & kuota menjadi fail-closed (hapus fallback in-memory di prod, tangani `DATABASE_UNAVAILABLE`)
- [ ] D3. Tutup open redirect (normalisasi & sanitasi `callbackURL`)
- [ ] D4. Keraskan Better Auth (`baseURL`, `trustedOrigins`, cookie secure/httponly/lax)
- [ ] D5. Validasi semua input (Zod schemas) dan sanitasi pesan error publik
- [ ] D6. Implementasikan CSP, security headers, dan privacy disclosure

## Tahap E — Perbaiki kebenaran simulasi sinyal

- [ ] E1. Definisikan kontrak produk sinyal immutable (`contextId` required, context-ticker match)
- [ ] E2. Perbaiki kalender BEI/KSEI 2026 (tambahkan 18 Maret, 15 Mei, 28 Mei, 24 Desember, dan nomor pengumuman resmi)
- [ ] E3. Bangun timeline simulasi kanonis (potong masa lalu berdasar `asOf`, sesi parsial)
- [ ] E4. Perbaiki state machine posisi (TP1 alokasi 1x, TP2 alokasi 1x, trailing stop 15m completed close)
- [ ] E5. Sensitivitas dan determinisme nyata (hapus multiplier buatan, rerun dengan random stream identik)
- [ ] E6. Kualitas data intraday (provenance jujur, hapus 2% heuristic ATR semu, VWAP & RVOL per sesi)
- [ ] E7. Batas performa sinkron 25.000 path dan caching deterministik

## Tahap F — Provider, kesehatan sistem, dan kebenaran klaim

- [ ] F1. Standarisasi Provider Envelope (`status`, `source`, `observedAt`, `sourceDelayMinutes`, `issues`, `data`)
- [ ] F2. Pisahkan liveness (`/api/live`) dan readiness (`/api/health`)
- [ ] F3. Observabilitas dan structured logging dengan sanitasi data pribadi

## Tahap G — Rapikan arsitektur tanpa rewrite besar

- [ ] G1. Pecah `app/actions.ts` menurut domain (`market`, `watchlist`, `assistant`, `radar`, `signal`) dengan backward-compatible re-exports
- [ ] G2. Pecah komponen raksasa `StockDetail.tsx` ke tab-tab modular
- [ ] G3. Kanonisasi kode duplikat dan klasifikasi aman `scratch/`
