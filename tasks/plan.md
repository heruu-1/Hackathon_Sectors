# RASI Implementation Plan & Specification

## 1. Status Baseline & Yang Sudah Terpasang

- Route riset: `/saham`, `/saham/[ticker]`, `/screener`, `/radar`, `/bandingkan`, `/watchlist`, `/riwayat`, `/belajar`, `/asisten`, `/pengaturan`, dan `/masuk`.
- Shell navigasi responsif, skip link, focus-visible, tema sistem/terang/gelap, dan mode pemula.
- Pencarian saham dengan debounce, dropdown hasil, loading, empty, dan error.
- Screener Sectors berhalaman 25 baris, URL filter, preset ukuran/dividen/pertumbuhan/valuasi.
- Watchlist dengan kepemilikan akun, deduplikasi `(userId, ticker)`, error tetap membuka modal, dan konfirmasi aksi Asisten.
- Better Auth Google OAuth, schema Drizzle, handler Next.js, dan migrasi SQL aditif.
- Cache Sectors memakai PostgreSQL `api_cache` bila database tersedia.
- Provenance analisis Gemini/aturan disimpan pada snapshot; pembanding harga buatan radar dan insider dihapus.

## 2. Pemetaan Temuan Audit (F01 - F16)

| ID  | Temuan                                                                                     | Dampak                                                      | Solusi & Tugas                                                                       |
| --- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| F01 | Build produksi gagal pada halaman login                                                    | Menghalangi deployment                                      | Bungkus `useSearchParams` dengan `Suspense` (A02)                                    |
| F02 | Secret autentikasi bawaan tetap digunakan ketika env kosong                                | Konfigurasi produksi tidak aman                             | Validasi env ketat, tolak dev secret di prod (A04, B03)                              |
| F03 | Riwayat dibaca tanpa pemilik akun                                                          | Riwayat belum pribadi                                       | Pisahkan snapshot publik dan riwayat akun (B02, D04)                                 |
| F04 | Membuka detail, membandingkan, dan bertanya ke AI memanggil analisis yang melakukan insert | Penulisan berulang dan konsumsi kuota                       | Pisahkan `readStockData`, `readLatestAnalysis`, dan `createAnalysis` (D01, E03, E06) |
| F05 | Kegagalan provider diubah menjadi array kosong                                             | Kegagalan terlihat sebagai tidak ada aktivitas              | Kontrak `DataEnvelope` dengan status `error`/`empty`/`partial` (A03, C01, C02)       |
| F06 | Persentase insider dikalikan 100 lagi                                                      | `2,56%` menjadi `256%`                                      | Perbaiki formula di domain insider (C05)                                             |
| F07 | Identitas broker asing dipakai sebagai arus investor asing                                 | Makna indikator tidak tepat                                 | Pisahkan `is_foreign` broker dari `f_bval`/`f_sval` investor asing (C06)             |
| F08 | Radar selalu mengirim pembanding harga `null`                                              | Sleeping Giant tidak dapat terdeteksi melalui alur tersebut | Sediakan pembanding harga yang valid dari seri perdagangan (C07, E07)                |
| F09 | Satu observasi volume menghasilkan `NORMAL 1x`                                             | Data tidak cukup terlihat sebagai hasil valid               | Validasi minimal 21 observasi SMA-20 (C06)                                           |
| F10 | Pembatasan asisten memakai `Map` dalam proses                                              | Tidak konsisten lintas instance Vercel                      | Quota atomik berbasis PostgreSQL `quota_buckets` (B02, C04)                          |
| F11 | Percakapan hanya berada di state browser                                                   | Hilang saat halaman dimuat ulang                            | Simpan percakapan di `conversations` & `conversation_messages` (B02, D05)            |
| F12 | Sumber AI diterima dari model, tetapi tidak ditampilkan lengkap                            | Jawaban sulit ditelusuri                                    | Server membentuk daftar sumber dari snapshot, tampilkan di UI (D05, E09)             |
| F13 | Mode pemula hanya disimpan di pengaturan                                                   | Preferensi belum memengaruhi fitur                          | Terapkan mode pemula/detail secara konsisten ke seluruh halaman (E10)                |
| F14 | Halaman lama dan baru memakai struktur visual berbeda                                      | Navigasi dan tema tidak konsisten                           | Seragamkan shell, navigasi, dan header status sesi (E01)                             |
| F15 | Migrasi mengasumsikan tabel lama sudah ada                                                 | Instalasi database kosong belum reproduktif                 | Sediakan baseline migration mandiri (B01)                                            |
| F16 | Skrip seed menunjuk file tidak tersedia                                                    | Dokumentasi/perintah tidak dapat diandalkan                 | Buat script seed yang benar dan dapat diandalkan (F04)                               |

## 3. Arsitektur Berlapis & Keputusan Desain

```text
Halaman / komponen
        ↓
Server Action atau Route Handler
        ↓
Validasi input + sesi + kebijakan akses (Zod + Better Auth)
        ↓
Layanan fitur (lib/server/services/)
        ↓
Repository PostgreSQL / adapter provider (lib/server/repositories/ & providers/)
        ↓
Normalisasi data (DataEnvelope)
        ↓
Perhitungan indikator murni (domain/)
        ↓
DTO aman untuk UI
```

- **Database**: PostgreSQL lokal port 5433 (`.local/postgres`). Jangan ubah ke 5432.
- **Isolasi Akun**: Watchlist, riwayat, dan percakapan milik pengguna. Data pasar publik dipisahkan.
- **Skor Komposit**: 4 pilar lengkap (Fundamental 25%, Broker 35%, Divergensi 25%, Insider 15%). Jika tidak lengkap, `compositeScore = null`, status `INSUFFICIENT_DATA`.
- **Waktu**: UTC di DB (`timestamptz`), tampilan di `Asia/Jakarta` (WIB).

## 4. Verifikasi Baseline

- `tsc --noEmit --incremental false`: EXIT 0
- `eslint`: EXIT 0
- `prettier --check`: EXIT 0
- Fixture test (`tests/intelligence.test.mjs`, `tests/sectors.test.mjs`): 21 lulus

---

## 5. Audit Klaim Lama & Rencana Penyempurnaan UI/UX (U00 - U11)

### Status Audit Klaim Implementasi Sebelumnya:

- **Terverifikasi (Backend, Auth, Provider, Kontrak)**:
  - Fase A (Route wrapper Suspense, kontrak data, Zod, env validation).
  - Fase B (Drizzle schema, migrasi, sesi Better Auth, isolasi akun).
  - Fase C (Adapter Sectors, cache LRU + Postgres, kuota atomik, koreksi insider/volume/divergensi/scoring).
  - Fase D (Pemisahan readStockData vs createAnalysis, idempotensi requestKey, watchlist/history service).
- **Belum Terbukti / Belum Selesai (UI/UX Lama)**:
  - E01: ResearchShell terduplikasi di setiap halaman, `/` masih berupa terminal lama 1.784 baris.
  - E02: Pencarian saham belum menerapkan WAI-ARIA combobox, Back URL sync, dan pembatalan stale request.
  - E03: StockDetail masih memanggil `analyzeTicker` (memanggil Gemini pada pembacaan biasa), belum ada adapter presentasi.
  - E04: **Klaim keliru** — grafik riwayat harga/volume dan SMA-20 sebenarnya belum ada di `StockDetail.tsx`.
  - E05: Screener masih memiliki filter inline kompleks tanpa modal draft/apply dan tombol redundan.
  - E06: Pembanding masih memanggil `analyzeTicker` berulang (memanggil Gemini) dan belum responsif horizontal sticky.
  - E07: Radar masih menumpang pada tab terminal lama di `app/page.tsx`.
  - E08: Watchlist & Riwayat masih menumpang pada tab terminal lama di `app/page.tsx`.
  - E09: Asisten UI belum mengirim parameter `conversationId`, `snapshotId`, `requestKey`.
  - E10: Mode pemula/detail di Pengaturan belum terhubung ke komponen untuk menyembunyikan/membuka metrik.

### Paket Kerja UI/UX RASI (U00 - U11):

- **U00**: Catat baseline dan revisi checklist pada `tasks/plan.md`, `tasks/todo.md`, `tasks/verification.md`.
- **U01**: Token warna dan tombol bersama (`app/globals.css`, `components/ui/Button.tsx`, `components/ui/IconButton.tsx`, `components/ui/ButtonLink.tsx`).
- **U02**: `Dialog` dan menu tindakan bersama (`components/ui/Dialog.tsx`, `components/ui/ActionMenu.tsx`).
- **U03a**: Shell tunggal melalui layout (`app/layout.tsx`) dan `components/ResearchShell.tsx`.
- **U03b**: Pindahkan radar, pantauan, riwayat dari terminal lama ke halaman masing-masing (`app/radar/`, `app/watchlist/`, `app/riwayat/`).
- **U04**: Komponen pencarian bersama untuk `/` dan `/saham` (`components/StockSearch.tsx`).
- **U05**: Adapter presentasi dan ringkasan `StockDetail` (`lib/presentation/stock.ts`, `components/StockDetail.tsx`).
- **U06**: Grafik dan tabel riwayat sebenarnya (`components/StockChart.tsx`).
- **U07**: Pratinjau saham bersama dan integrasi daftar (`components/StockPreviewDialog.tsx`).
- **U08a**: Filter draft/apply dan penyederhanaan penyaring (`components/ScreenerFilterDialog.tsx`, `app/screener/page.tsx`).
- **U08b**: Pilihan saham dan halaman perbandingan (`app/bandingkan/page.tsx`).
- **U09**: Pantauan, edit catatan, riwayat, dan kembali setelah login (`components/WatchlistNoteDialog.tsx`, `components/WatchlistDeleteDialog.tsx`).
- **U10a**: Sinkronisasi kontrak dan riwayat percakapan asisten (`app/asisten/page.tsx`, `app/actions.ts`).
- **U10b**: Preferensi pemula/detail dan pengaturan tema (`components/ThemePreferenceProvider.tsx`, `app/pengaturan/page.tsx`).
- **U11**: Pengujian lintas halaman dan bukti akhir.
