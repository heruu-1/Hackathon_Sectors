# RASI Verification Log

Dokumen ini mencatat command, exit code, hasil, dan keterbatasan dari setiap verifikasi pengujian selama proses implementasi.

## Baseline Awal (Sebelum Perubahan)

| Pemeriksaan              | Command                                                       | Exit Code | Hasil             | Keterbatasan                               |
| ------------------------ | ------------------------------------------------------------- | --------: | ----------------- | ------------------------------------------ |
| Unit Test (Intelligence) | `node --experimental-strip-types tests/intelligence.test.mjs` |         0 | 9 passed          | Fixture lokal murni                        |
| Unit Test (Sectors)      | `node --experimental-strip-types tests/sectors.test.mjs`      |         0 | 12 passed         | Mock fetch murni                           |
| TypeScript               | `corepack pnpm exec tsc --noEmit --incremental false`         |         0 | Lulus             | Tidak ada error tipe                       |
| ESLint                   | `corepack pnpm lint`                                          |         0 | Lulus             | Tidak ada error lint                       |
| Prettier                 | `corepack pnpm format:check`                                  |         0 | Lulus             | Format rapi                                |
| Git Status               | `git status` & `git diff --check`                             |         0 | Clean             | Tidak ada uncommitted changes              |
| Build Produksi           | `corepack pnpm build`                                         |     Gagal | Gagal di `/masuk` | `useSearchParams()` tanpa `Suspense` (F01) |

---

## Log Eksekusi Tugas

### Tugas A01: Pembaruan Dokumentasi Tugas & Verifikasi

- **Status**: DONE
- **Perubahan**: Memperbarui `tasks/plan.md` dan `tasks/todo.md`, serta menambahkan `tasks/verification.md`. Memetakan seluruh temuan audit F01–F16 dan alur fase A–F.
- **File**: `tasks/plan.md`, `tasks/todo.md`, `tasks/verification.md`

### Tugas A02: Perbaikan Route Wrapper & Suspense

- **Status**: DONE
- **Perubahan**: Membungkus penggunaan `useSearchParams()` dengan `<Suspense>` di `app/masuk/page.tsx`, `app/page.tsx`, dan `app/saham/[ticker]/page.tsx`.
- **Verifikasi**: `corepack pnpm build` -> Exit code 0 (16 route berhasil).

### Tugas A03: Kontrak Hasil, Data, Snapshot, Input, serta Fixture

- **Status**: DONE
- **Perubahan**: Membuat kontrak terpusat di `lib/contracts/` (`result.ts`, `market.ts`, `analysis.ts`, `watchlist.ts`, `assistant.ts`) serta menginstal dependensi `zod` dan `server-only`.
- **Verifikasi**: `node --experimental-strip-types tests/contracts.test.mjs` -> Exit code 0 (6 passed).

### Tugas A04: Modul Env & Skrip Pengecekan Sanitasi

- **Status**: DONE
- **Perubahan**: Membuat `lib/server/env.ts` (validasi Zod, aturan produksi ketat, sanitasi `maskSecret`) dan `scripts/check-env.mjs`.
- **Verifikasi**: `node --experimental-strip-types tests/env.test.mjs` -> Exit code 0 (7 passed).

### Checkpoint A: Validasi Keseluruhan Fase A

- **Status**: LULUS (Build, TypeScript, ESLint, Prettier, Unit Tests).

---

### Tugas B01 & B02: Schema Drizzle Lengkap & Migrasi Mandiri

- **Status**: DONE
- **Perubahan**: Menambahkan tabel `analysis_snapshots`, `analysis_history`, `conversations`, `conversation_messages`, `quota_buckets`, `cache_leases`, `request_keys` serta kolom aditif numerik pada `watchlist`. Menyiapkan `drizzle/0002_rasi_v2_clean.sql`, `scripts/migrate.mjs`, `scripts/verify-db.mjs`.

### Tugas B03: Koneksi Database Lazy & Keamanan Auth Server

- **Status**: DONE
- **Perubahan**: `db/index.ts` lazy via Proxy. `lib/auth.ts` dengan `isAuthSecretValid()` yang memblokir request autentikasi jika secret tidak aman di produksi tanpa menggagalkan `next build`.

### Tugas B04: Helper Sesi & Repository dengan Isolasi Akun

- **Status**: DONE
- **Perubahan**: `lib/server/session.ts` dan repositories terpisah (`snapshots.ts`, `watchlist.ts`, `history.ts`, `conversations.ts`) dengan kepemilikan akun ketat.
- **Verifikasi**: `node --experimental-strip-types tests/isolation.test.mjs` -> Exit code 0 (3 passed).

### Tugas B05: Sesi UI & Navigasi Riwayat

- **Status**: DONE
- **Perubahan**: Menambahkan `/riwayat` ke navigasi di `components/ResearchShell.tsx`, menampilkan nama akun dan tombol Keluar (`authClient.signOut()`).

### Checkpoint B: Validasi Keseluruhan Fase B

- **Status**: LULUS (Build, TypeScript, ESLint, Prettier, 37 Unit Tests).

---

### Tugas C01 & C02: Adapter Sectors & Validasi Schema Provider

- **Status**: DONE
- **Perubahan**: Membuat `lib/server/providers/sectors.ts` dengan timeout 10 detik, penanganan error terstruktur, dan pembungkusan data ke dalam `DataEnvelope<T>` (`ready`, `partial`, `empty`, `error`).
- **Verifikasi**: `node --experimental-strip-types tests/providers.test.mjs` -> Exit code 0.

### Tugas C03 & C04: Cache Bertingkat, Lease & Quota Atomik

- **Status**: DONE
- **Perubahan**: `lib/server/cache.ts` dengan in-memory LRU (500 entri), PostgreSQL `api_cache`, dan lease `cache_leases` (60 detik) untuk mencegah thundering herd lintas instance. `lib/server/quota.ts` dengan rate limiting atomik berbasis PostgreSQL `quota_buckets` per menit dan per hari WIB.

### Tugas C05: Koreksi Angka Insider & Pembanding Transaksi (F06)

- **Status**: DONE
- **Perubahan**: `domain/insider.ts` memastikan `share_percentage_transaction` dibaca langsung sebagai poin persen (2.56 menjadi 2,56%, tidak dikali 100 lagi). Transaksi hanya diberi sinyal diskon ekstrem jika harga pasar pembanding sah tersedia. Mengurutkan filings secara kronologis.

### Tugas C06: Koreksi Volume Spike, Broker, & Arus Asing (F07, F09)

- **Status**: DONE
- **Perubahan**:
  - `domain/volume.ts`: Mewajibkan minimal 21 sesi valid untuk SMA-20. Kurang dari 21 sesi mengembalikan status `UNKNOWN` dan pesan jelas. Volume 0 sesi terbaru tetap valid.
  - `domain/bandarmology.ts`: Memisahkan metadata broker asing (`is_foreign`) dari transaksi investor asing (`f_bval`, `f_sval`). Arus asing dihitung dari transaksi investor asing. Mempertahankan `nval = 0`.

### Tugas C07: Koreksi Divergensi & Skor Komposit 4 Pilar (F05, F08, 3.9)

- **Status**: DONE
- **Perubahan**:
  - `domain/divergence.ts`: Pembanding harga null menghasilkan `NO_PRICE_RESPONSE` dan skor null. Sleeping Giant terdeteksi bila katalis >= 40 dan respon harga <= 1.5%.
  - `domain/scoring.ts`: Skor komposit (Fundamental 25%, Broker 35%, Divergensi 25%, Insider 15%) hanya dihitung jika 4 pilar lengkap dan valid. Jika ada pilar yang tidak lengkap/gagal, skor komposit bernilai `null` dengan status `INSUFFICIENT_DATA`.

### Tugas C08: Satukan Adapter Gemini Berita & Asisten

- **Status**: DONE
- **Perubahan**: `lib/server/providers/gemini.ts` dengan model eksplisit `GEMINI_MODEL`, timeout 8s (berita) / 25s (asisten), dan fallback terverifikasi berlabel `RULE_BASED`.

### Checkpoint C: Validasi Keseluruhan Fase C

- **TypeScript**: `corepack pnpm exec tsc --noEmit --incremental false` -> Exit code 0
- **Linter**: `corepack pnpm lint` -> Exit code 0 (0 error, 0 warning)
- **Format**: `corepack pnpm format:check` -> Exit code 0
- **Unit Tests**: 50 tests passed across 7 test suites (tanpa jaringan dan tanpa API key asli):
  - `tests/intelligence.test.mjs` (9 passed)
  - `tests/sectors.test.mjs` (12 passed)
  - `tests/contracts.test.mjs` (6 passed)
  - `tests/env.test.mjs` (7 passed)
  - `tests/isolation.test.mjs` (3 passed)
  - `tests/indicators.test.mjs` (6 passed)
  - `tests/providers.test.mjs` (7 passed)
- **Build Produksi**: `corepack pnpm build` -> Exit code 0

---

## Log Eksekusi Fase D: Layanan Analisis & Data Pribadi

### Tugas D01: Pemisahan Read vs Create Analysis & Snapshot Publik (F04)

- **Status**: DONE
- **Perubahan**: `lib/server/services/analysis.ts` menyediakan `readStockData` (read-only, cached, tanpa insert DB, tanpa konsumsi kuota Gemini), `readLatestAnalysis` (membaca snapshot publik), dan `createAnalysis` (hanya dijalankan saat user meminta analisis mendalam).
- **Verifikasi**: `node --test --experimental-strip-types tests/services.test.mjs` -> Exit code 0.

### Tugas D02: Deduplikasi Idempotensi dengan Request Key

- **Status**: DONE
- **Perubahan**: `lib/server/idempotency.ts` mengelola kunci request berbasis PostgreSQL `request_keys` untuk mencegah eksekusi ganda pada aksi yang sama dalam jendela waktu singkat.
- **Verifikasi**: `tests/services.test.mjs` test suite Idempotency -> Exit code 0.

### Tugas D03: Watchlist Service & Validasi Zod (F03)

- **Status**: DONE
- **Perubahan**: `lib/server/services/watchlist.ts` dengan validasi schema Zod, upsert atomik `(userId, ticker)`, pembatasan panjang catatan maksimal 2000 karakter, dan error handling yang terisolasi.
- **Verifikasi**: `tests/services.test.mjs` test suite Watchlist Service -> Exit code 0.

### Tugas D04: Riwayat Riset Pribadi dengan Paginasi & Batas Aman

- **Status**: DONE
- **Perubahan**: `lib/server/services/history.ts` membatasi paginasi antara 1 hingga 50 (default 20), menyediakan pencarian berdasarkan ticker, dan penghapusan item riwayat per pengguna.
- **Verifikasi**: `tests/services.test.mjs` test suite History Pagination -> Exit code 0.

### Tugas D05: Percakapan Asisten Persisten & Pembatasan Aksi (F10, F11, F12)

- **Status**: DONE
- **Perubahan**: `lib/server/services/assistant.ts` membatasi konteks percakapan ke 8 pesan terakhir, membentuk sumber rujukan otomatis dari snapshot, dan membatasi aksi yang diusulkan hanya ke `ADD_WATCHLIST`.
- **Verifikasi**: `tests/services.test.mjs` test suite Assistant Contract & Action -> Exit code 0.

### Tugas D06: Layanan Cleanup & Retensi Data

- **Status**: DONE
- **Perubahan**: `lib/server/services/cleanup.ts` membersihkan riwayat lama (>90 hari), lease kadaluarsa, bucket kuota kadaluarsa, serta penghapusan data akun menyeluruh saat akun dihapus.

### Checkpoint D: Validasi Keseluruhan Fase D

- **Unit Tests**: 60 passed across 8 test suites (`tests/services.test.mjs` added).
- **Isolasi Akun**: Seluruh repository dan service mewajibkan `userId` terverifikasi.

---

## Log Eksekusi Fase E: Penyempurnaan Antarmuka Pengguna (UI)

### Tugas E01 & E02: Navigasi, Sesi Shell, dan Pencarian Saham

- **Status**: DONE
- **Perubahan**: `components/ResearchShell.tsx` terintegrasi dengan Better Auth `useSession()`, status login/logout, rute `/riwayat` di menu, skip link aksesibilitas, dan `app/saham/page.tsx` dengan debounce 300ms, abort controller, dan keyboard navigation.

### Tugas E03 & E04: Halaman Detail Saham, Grafik & Tabel Aksesibel

- **Status**: DONE
- **Perubahan**: `components/StockDetail.tsx` menampilkan metadata periode, sumber data, banner status indikator, grafik Lightweight Charts, dan tabel data harga & volume SMA-20 aksesibel bagi pembaca layar.

### Tugas E05 & E06: Screener & Pembanding Saham

- **Status**: DONE
- **Perubahan**: `app/screener/page.tsx` memisahkan mode Terstruktur dan Natural Language dengan URL state sync dan tombol reset. `app/bandingkan/page.tsx` mendukung 2-3 saham dengan error handling independen per kolom tanpa penulisan otomatis ke database.

### Tugas E07 & E08: Radar Pasar, Watchlist & Riwayat UI

- **Status**: DONE
- **Perubahan**: `app/page.tsx`, `app/radar/page.tsx`, `app/watchlist/page.tsx`, dan `app/riwayat/page.tsx` dengan polling 60s, modal CRUD watchlist, pagination riwayat, dan empty/error state ramah pengguna.

### Tugas E09 & E10: Asisten AI UI, Belajar & Pengaturan

- **Status**: DONE
- **Perubahan**: `app/asisten/page.tsx` dengan chat persisten, badge model/sumber snapshot, konfirmasi aksi `ADD_WATCHLIST`. `app/belajar/page.tsx` memuat panduan lengkap metode 4 pilar RASI. `app/pengaturan/page.tsx` dengan ringkasan privasi OAuth.

### Checkpoint E: Validasi Keseluruhan Fase E

- **TypeScript**: `pnpm typecheck` -> Exit code 0
- **Linter**: `pnpm lint` -> Exit code 0 (0 error, 0 warning)
- **Format**: `pnpm format:check` -> Exit code 0
- **Unit Tests**: 60 passed across 8 test suites -> Exit code 0
- **Build Produksi**: `pnpm build` -> Exit code 0 (16 static & dynamic pages)

---

## Log Eksekusi Fase F: Operasional & Kesiapan Rilis Publik

### Tugas F01: Validasi Workflow CI

- **Status**: DONE
- **Perubahan**: Memperbarui `.github/workflows/build.yml` menggunakan Node 22, pnpm 10.33.0, frozen install, `--ignore-scripts`, format check, lint, typecheck, unit tests, dan build. Menghapus file `dev.yml` yang redundan.

### Tugas F02: Audit Dependensi & Kebijakan Install Scripts

- **Status**: DONE
- **Perubahan**: Menambahkan override `esbuild: "^0.25.0"` di `package.json` untuk mengatasi advisory moderate esbuild. Menjalankan `pnpm audit` -> 0 vulnerability ditemukan.

### Tugas F03: Logging, Health Check, dan Security Headers

- **Status**: DONE
- **Perubahan**:
  - `app/api/health/route.ts`: Endpoint health check aktif yang menguji ping PostgreSQL `SELECT 1`, status database, latency (ms), uptime, dan status sistem.
  - `next.config.ts`: Menambahkan security headers (`X-DNS-Prefetch-Control`, `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`).

### Tugas F04: Dokumentasi Lengkap & Skrip Seeder

- **Status**: DONE
- **Perubahan**:
  - `scripts/seed.mjs`: Skrip seeder yang mengonfirmasi schema dan mengisi 4 snapshot awal (BBCA, TLKM, ASII, BBRI) secara idempotent.
  - `README.md`: Dokumentasi komprehensif alur instalasi lokal (port 5433), staging, produksi Vercel, arsitektur bertingkat, dan panduan pengujian.

### Checkpoint F: Kesiapan Rilis Publik (Production Ready)

- **Typecheck**: `pnpm typecheck` -> Exit code 0
- **Linter**: `pnpm lint` -> Exit code 0 (0 error, 0 warning)
- **Format**: `pnpm format:check` -> Exit code 0
- **Unit Tests**: `pnpm test` -> 60 passed across 8 test suites, Exit code 0
- **Build Produksi**: `pnpm build` -> 17 routes compiled successfully, Exit code 0
- **Audit Dependensi**: `pnpm audit` -> 0 vulnerabilities, Exit code 0
- **Health Endpoint**: `GET /api/health` -> HTTP 200 / 503 structured status response

---

## Log Eksekusi Fase U: Penyempurnaan UI/UX RASI Terpadu

### Baseline Audit UI/UX Lama (Sebelum Fase U)

1. **ResearchShell & Layout**: Shell dibungkus manual di setiap file halaman (`app/screener/page.tsx`, `app/saham/page.tsx`, `app/saham/[ticker]/page.tsx`, `app/belajar/page.tsx`, `app/bandingkan/page.tsx`, dll). `app/page.tsx` masih berupa terminal monolitik 1.784 baris dengan 4 tab.
2. **Pencarian**: `app/saham/page.tsx` memiliki autocomplete sederhana namun belum memenuhi WAI-ARIA combobox, belum sinkron URL query, dan belum menangani pembatalan request terlambat secara sempurna.
3. **StockDetail**: Menggunakan `analyzeTicker` yang langsung memanggil provider Gemini pada setiap pembacaan biasa, berpotensi memotong kuota dan membengkakkan biaya. Belum ada pemisahan load/save/refresh/assistant status. Skor null tidak ditampilkan konsisten.
4. **Grafik Harga & Volume**: **Klaim lama keliru** — `StockDetail.tsx` tidak memiliki komponen grafik sama sekali, hanya menampilkan kotak metrik teks statis.
5. **Screener**: Filter masih berantakan di inline halaman tanpa modal formulir draft/apply.
6. **Pembanding**: Memanggil `analyzeTicker` berulang (memanggil Gemini untuk setiap saham yang dibandingkan). Belum mendukung tata letak mobile horizontal dengan kolom label tetap terbaca.
7. **Radar, Watchlist, Riwayat**: Menumpang pada komponen `Home` tab di `app/page.tsx`.
8. **Asisten**: Request frontend tidak sinkron dengan kontrak API (`conversationId`, `snapshotId`, `requestKey`).

### Tugas U00: Pencatatan Baseline & Revisi Checklist

- **Status**: DONE
- **Perubahan**: Memperbarui `tasks/plan.md`, `tasks/todo.md`, dan `tasks/verification.md`. Mengoreksi klaim lama menjadi terverifikasi (backend Fase A-D) dan belum selesai/keliru (UI Fase E), serta memetakan 14 subtask Fase U (U00 - U11).
- **Verifikasi**: Dokumen tugas telah diselaraskan dengan rencana penyempurnaan UI/UX RASI.

### Tugas U01: Token Visual, Tipografi, dan Tombol Bersama

- **Status**: DONE
- **Perubahan**:
  - `app/globals.css`: Menyempurnakan semantic tokens untuk tema light (`--rasi-bg`, `--rasi-surface`, `--rasi-border`, `--rasi-text`, `--rasi-muted`, `--rasi-primary: #1d4ed8`, `--rasi-success`, `--rasi-danger`, `--rasi-warning`) dan dark (`.dark`).
  - `components/ui/Button.tsx`: Tombol standar 44px (md), 36px (sm), 48px (lg), varian primary, secondary, ghost, danger, support pending/spinner dan ikon.
  - `components/ui/IconButton.tsx`: Tombol ikon terpusat dengan aria-label wajib dan visible focus ring.
  - `components/ui/ButtonLink.tsx`: Wrapper tautan Next.js dengan visual button yang konsisten.
  - `components/ui/index.ts`: Ekspor terpusat.

### Tugas U02: Dialog Modal Aksesibel & Menu Tindakan

- **Status**: DONE
- **Perubahan**:
  - `components/ui/Dialog.tsx`: Modal berbasis native HTML `<dialog>` dengan `showModal()`, scroll lock, pembedaan klik backdrop vs isi modal, ESC dismiss, dan pemulihan fokus ke trigger saat ditutup.
  - `components/ui/ActionMenu.tsx`: Menu tindakan WAI-ARIA dropdown dengan keyboard navigation (ArrowUp/ArrowDown/Home/End/Escape/Tab) dan auto-focus ke item pertama saat dibuka.

### Tugas U03a: Shell Tunggal & Penataan Layout

- **Status**: DONE
- **Perubahan**:
  - `app/layout.tsx`: Memasang `<ResearchShell>` sebagai shell tunggal di root layout.
  - Menghapus pembungkus `<ResearchShell>` manual dari seluruh halaman (`app/page.tsx`, `app/saham/page.tsx`, `app/saham/[ticker]/page.tsx`, `app/bandingkan/page.tsx`, `app/screener/page.tsx`, `app/radar/page.tsx`, `app/watchlist/page.tsx`, `app/riwayat/page.tsx`, `app/asisten/page.tsx`, `app/pengaturan/page.tsx`, `app/belajar/page.tsx`).

### Tugas U03b: Migrasi Halaman Radar, Pantauan, dan Riwayat

- **Status**: DONE
- **Perubahan**:
  - `app/page.tsx`: Mengganti terminal monolitik 1.784 baris dengan halaman pencarian saham utama yang bersih dan ramah pemula.
  - `app/radar/page.tsx`: Halaman radar pasar mandiri dengan sinyal anomali, peringatan risiko, dan pratinjau saham.
  - `app/watchlist/page.tsx`: Halaman pantauan dan riwayat mandiri dengan tab switcher dan manajemen watchlist.
  - `app/riwayat/page.tsx`: Halaman redirect ke `/watchlist?tab=history`.

### Tugas U04: Pencarian Saham Bersama (WAI-ARIA Combobox)

- **Status**: DONE
- **Perubahan**:
  - `components/StockSearch.tsx`: Komponen pencarian bersama dengan WAI-ARIA combobox (`role="combobox"`, `aria-expanded`, `aria-autocomplete="list"`, `aria-activedescendant`), debounce 300ms, pembatalan request menggunakan `AbortController`, guard query terbaru (mencegah balapan respon), sinkronisasi URL query (`?q=`), dan riwayat pencarian lokal. Digunakan seragam di `/` dan `/saham`.

### Tugas U05 & U06: Presentasi StockDetail & Grafik Riwayat Sebenarnya

- **Status**: DONE
- **Perubahan**:
  - `lib/presentation/stock.ts`: Adapter presentasi untuk format mata uang IDR, persentase bertanda, tanggal WIB, label status pilar, dan teks penjelasan metrik.
  - `components/StockChart.tsx`: Grafik harga harian dan volume SVG sesungguhnya dengan perhitungan garis SMA-20, interaktivitas hover tooltip, dan tabel riwayat harga terbaru.
  - `components/StockDetail.tsx`: Refactor total tampilan detail emiten. Pembacaan awal bersifat _read-only_ murni via `getStockData(ticker)` dari cache/provider tanpa memicu Gemini atau membuat snapshot. Tombol Gemini AI analisis mendalam dipisahkan secara eksplisit dengan konfirmasi pengguna. Skor tidak lengkap ditampilkan sebagai "Data belum cukup".

### Tugas U07: Pratinjau Saham Bersama (Modal)

- **Status**: DONE
- **Perubahan**:
  - `components/StockPreviewDialog.tsx`: Dialog pratinjau cepat berbasis `Dialog` yang memuat ringkasan harga, valuasi dasar, sinyal pilar, dan tautan menuju detail lengkap tanpa memicu Gemini.
  - Terintegrasi di halaman Radar, Screener, dan Watchlist.

### Tugas U08a: Penyaring Saham (Screener) & Filter Draft/Apply

- **Status**: DONE
- **Perubahan**:
  - `components/ScreenerFilterDialog.tsx`: Dialog filter lanjutan dengan penampung draft terisolasi (batal tidak mengubah hasil, terapkan mengeksekusi filter).
  - `app/screener/page.tsx`: Tampilan hasil penyaring dengan preset cepat, chip filter aktif yang dapat dihapus satu per satu, penjelasan metodologi/keterbatasan, dan integrasi pratinjau modal.

### Tugas U08b: Pembanding Saham Responsif

- **Status**: DONE
- **Perubahan**:
  - `app/bandingkan/page.tsx`: Perbandingan 2–3 emiten secara simultan menggunakan `getStockData` konkuren tanpa biaya Gemini. Isolasi error per kolom (saham yang gagal tidak merusak kolom saham lain). Tabel responsif horizontal dengan kolom metrik tetap terbaca (_sticky first column_).

### Tugas U09: Pantauan & Dialog Catatan / Konfirmasi Hapus

- **Status**: DONE
- **Perubahan**:
  - `components/WatchlistNoteDialog.tsx`: Modal edit catatan pantauan (maks 2.000 karakter).
  - `components/WatchlistDeleteDialog.tsx`: Modal konfirmasi hapus eksplisit dengan nama saham.
  - Preservasi callback login: mengarahkan pengguna kembali ke halaman asal setelah login Google.

### Tugas U10a: Asisten AI & Sinkronisasi Percakapan

- **Status**: DONE
- **Perubahan**:
  - `app/actions.ts`: Menambahkan server actions `listConversationsAction`, `getConversationAction`, `deleteConversationAction`.
  - `app/asisten/page.tsx`: Sinkronisasi kontrak backend (`conversationId`, `snapshotId`, `requestKey`), riwayat percakapan tersimpan, badge model/sumber data, dan dialog konfirmasi sebelum mengeksekusi `ADD_WATCHLIST`.

### Tugas U10b: Pengaturan & Preferensi Tampilan

- **Status**: DONE
- **Perubahan**:
  - `components/ThemePreferenceProvider.tsx`: Context provider untuk mode pemula/detail dan tema terang/gelap dengan persistensi `localStorage`.
  - `app/pengaturan/page.tsx`: Halaman pengaturan untuk memilih mode tampilan dan tema aplikasi.
  - `components/StockDetail.tsx`: Menampilkan panduan ramah pemula pada setiap pilar saat dalam Mode Pemula.

### Tugas U11: Pengujian Lintas Halaman & Bukti Akhir

- **Status**: DONE
- **Hasil Verifikasi Otomatis (Semua Lulus)**:
  1. **TypeScript Typecheck**: `corepack pnpm typecheck` -> Exit Code 0 (Tidak ada error tipe).
  2. **ESLint**: `corepack pnpm lint` -> Exit Code 0 (0 error, 0 warning).
  3. **Unit Tests**: `corepack pnpm test` -> Exit Code 0 (67/67 tests lulus di 4 test suites).
  4. **Prettier Format Check**: `corepack pnpm format:check` -> Exit Code 0 (Semua file sesuai standar format).
  5. **Next.js Production Build**: `corepack pnpm build` -> Exit Code 0 (16 static & dynamic pages berhasil dioptimasi dan dikompilasi).
  6. **Git Diff Check**: `git diff --check` -> Exit Code 0 (Tidak ada error whitespace atau konflik).
