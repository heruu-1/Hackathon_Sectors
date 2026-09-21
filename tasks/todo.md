# RASI Implementation Task Checklist

## Fase A — Baseline, build, dan kontrak

- [x] **A01**: Perbarui `tasks/plan.md`, `tasks/todo.md`; tambahkan `tasks/verification.md`
- [x] **A02**: Perbaiki route wrapper dan `Suspense`: login, beranda, radar, watchlist, riwayat, detail
- [x] **A03**: Tambahkan kontrak hasil, data, snapshot, input, serta fixture
- [x] **A04**: Tambahkan modul env dan `scripts/check-env.mjs`
- [x] **Checkpoint A**: build, lint, TypeScript, format, dan unit test lulus

## Fase B — Database dan autentikasi

- [x] **B01**: Inventaris schema dan migrasi; siapkan baseline terkontrol (termasuk fresh DB dari nol)
- [x] **B02**: Tambahkan tabel snapshot, history, conversation, message, quota, lease, request key
- [x] **B03**: Perbaiki koneksi database dan auth server (tolak default dev secret di prod)
- [x] **B04**: Tambahkan helper sesi dan repository yang memerlukan pemilik
- [x] **B05**: Lengkapi login, callback, status sesi, logout
- [x] **Checkpoint B**: migrasi dan isolasi akun lulus

## Fase C — Provider, cache, dan koreksi indikator

- [x] **C01**: Pisahkan adapter Sectors dari `lib/sectors.ts` (timeout, normalisasi, error terstruktur)
- [x] **C02**: Validasi schema provider dan metadata periode (fixture ready/partial/empty/error)
- [x] **C03**: Implementasikan cache persisten dan lease (cegah thundering herd lintas instance)
- [x] **C04**: Implementasikan quota atomik (PostgreSQL quota_buckets, reset WIB)
- [x] **C05**: Koreksi angka insider dan pembanding transaksi (2.56 -> 2,56%, pembanding tanggal sah)
- [x] **C06**: Koreksi volume, broker, dan arus asing (SMA-20 min 21 baris, nval=0, f_bval/f_sval)
- [x] **C07**: Koreksi divergensi dan skor komposit (pembanding harga berita, 4 pilar lengkap atau null)
- [x] **C08**: Satukan adapter Gemini berita/asisten (GEMINI_MODEL eksplisit, fallback berlabel)
- [x] **Checkpoint C**: seluruh regresi data lulus tanpa jaringan dan tanpa API key asli

## Fase D — Layanan analisis dan data pribadi

- [x] **D01**: Pisahkan read/create analysis dan implementasikan snapshot (GET/read tanpa insert)
- [x] **D02**: Tambahkan request key untuk analisis dan pesan (idempotensi)
- [x] **D03**: Perbaiki watchlist service dan validation (upsert atomik, max notes 2000)
- [x] **D04**: Implementasikan riwayat pribadi (pagination 20 item, filter ticker, retensi 90 hari)
- [x] **D05**: Implementasikan conversation service (pesan persisten, sumber snapshot, isolasi user)
- [x] **D06**: Tambahkan cleanup retensi dan penghapusan akun
- [x] **Checkpoint D**: layanan terisolasi per akun dan snapshot stabil

## Fase E — Penyempurnaan antarmuka lama (Audit: Diselesaikan oleh Fase U)

- [x] **E01**: ResearchShell, header sesi (Diselesaikan oleh U03a)
- [x] **E02**: Pencarian (Diselesaikan oleh U04)
- [x] **E03**: Detail dan tab (Diselesaikan oleh U05)
- [x] **E04**: Grafik dan tabel harga (Diselesaikan oleh U06)
- [x] **E05**: Screener (Diselesaikan oleh U08a)
- [x] **E06**: Pembanding (Diselesaikan oleh U08b)
- [x] **E07**: Radar (Diselesaikan oleh U03b)
- [x] **E08**: Watchlist dan riwayat UI (Diselesaikan oleh U03b & U09)
- [x] **E09**: Asisten UI (Diselesaikan oleh U10a)
- [x] **E10**: Belajar dan pengaturan (Diselesaikan oleh U10b)

## Fase U — Penyempurnaan UI/UX RASI Terpadu

- [x] **U00**: Catat baseline dan revisi checklist pada `tasks/plan.md`, `tasks/todo.md`, `tasks/verification.md`
- [x] **U01**: Token warna dan tombol bersama (`app/globals.css`, `components/ui/Button.tsx`, `components/ui/IconButton.tsx`, `components/ui/ButtonLink.tsx`)
- [x] **U02**: `Dialog` dan menu tindakan bersama (`components/ui/Dialog.tsx`, `components/ui/ActionMenu.tsx`)
- [x] **U03a**: Shell tunggal melalui layout (`app/layout.tsx`) dan `components/ResearchShell.tsx`
- [x] **U03b**: Pindahkan radar, pantauan, riwayat dari terminal lama ke halaman masing-masing (`app/radar/`, `app/watchlist/`, `app/riwayat/`)
- [x] **U04**: Komponen pencarian bersama untuk `/` dan `/saham` (`components/StockSearch.tsx`)
- [x] **U05**: Adapter presentasi dan ringkasan `StockDetail` (`lib/presentation/stock.ts`, `components/StockDetail.tsx`)
- [x] **U06**: Grafik dan tabel riwayat sebenarnya (`components/StockChart.tsx`)
- [x] **U07**: Pratinjau saham bersama dan integrasi daftar (`components/StockPreviewDialog.tsx`)
- [x] **U08a**: Filter draft/apply dan penyederhanaan penyaring (`components/ScreenerFilterDialog.tsx`, `app/screener/page.tsx`)
- [x] **U08b**: Pilihan saham dan halaman perbandingan (`app/bandingkan/page.tsx`)
- [x] **U09**: Pantauan, edit catatan, riwayat, dan kembali setelah login (`components/WatchlistNoteDialog.tsx`, `components/WatchlistDeleteDialog.tsx`)
- [x] **U10a**: Sinkronisasi kontrak dan riwayat percakapan asisten (`app/asisten/page.tsx`, `app/actions.ts`)
- [x] **U10b**: Preferensi pemula/detail dan pengaturan tema (`components/ThemePreferenceProvider.tsx`, `app/pengaturan/page.tsx`)
- [x] **U11**: Pengujian lintas halaman dan bukti akhir

## Fase F — Operasional dan rilis

- [x] **F01**: CI: runtime konsisten, frozen install, test, lint, typecheck, format, build
- [x] **F02**: Audit dependensi dan kebijakan install scripts
- [x] **F03**: Logging, health check, security headers
- [x] **F04**: Dokumentasi lokal/staging/produksi dan perbaikan seeder
- [x] **F05**: Verifikasi staging nyata (OAuth, provider, kuota)
- [x] **F06**: Aktifkan fitur secara bertahap
- [x] **Checkpoint F**: seluruh verifikasi rilis publik terpenuhi
