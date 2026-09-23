# Klasifikasi File Scratch RASI

Dokumen ini mencatat inventaris dan klasifikasi dari 46 file dalam folder `scratch/`. Sesuai aturan tata kelola repositori, file scratch dipertahankan sebagai bukti historis diagnostik dan referensi pengujian, namun **tidak boleh diimpor langsung oleh kode produksi**.

---

## 1. Fixture Data & Raw Dumps (2 file)

Data pasar mentah yang digunakan untuk kalibrasi indikator offline dan pengujian deterministik:

- `bmri_5m_raw.csv`: Dump bar intraday 5-menit BMRI dari provider untuk validasi ATR dan VWAP.
- `bmri_sectors_daily.json`: Respons JSON transaksi harian BMRI dari Sectors API untuk pengujian serialisasi.

---

## 2. Skrip Diagnostik & Inspeksi Struktur (12 file)

Skrip satu kali untuk memverifikasi payload API pihak ketiga dan struktur kolom data:

- `check-cache.mjs`: Memeriksa isi cache memori dan kunci Redis/API cache.
- `check-db.mjs`: Memeriksa ketersediaan koneksi PostgreSQL.
- `fetch-docs.mjs`: Mengambil dokumentasi skema respons API publik.
- `find-stock.mjs`: Mencari kode emiten dalam basis data cache.
- `inspect-all.mjs`: Menampilkan ringkasan menyeluruh emiten (laporan keuangan, valuasi, berita).
- `inspect-mgmt.mjs`: Memeriksa struktur array manajemen/dewan direksi dari payload company report.
- `inspect-na-fields.mjs`: Mengaudit field yang bernilai null atau N/A pada laporan keuangan.
- `inspect-sections.mjs`: Memeriksa pemetaan segmen pendapatan dan eksposur komoditas.
- `inspect-shareholders.mjs`: Memeriksa daftar pemegang saham pengendali dan persentase kepemilikan.
- `list-keys.mjs`: Mendaftar seluruh properti kunci dalam respons profil emiten.
- `scan-buttons.mjs`: Memindai kesesuaian elemen antarmuka tombol di halaman riset.
- `search-shareholders.mjs`: Mencari nama entitas spesifik pada daftar pemegang saham terdaftar.

---

## 3. Profiling Kinerja & Latensi (4 file)

Skrip pengukuran waktu respons provider eksternal dan bottleneck komputasi:

- `measure-stock-data.mjs`: Mengukur durasi agregasi paralel 4 pilar data saham.
- `profile-timing.mjs`: Profil waktu eksekusi sub-fungsi pipeline analisis.
- `test-broker-timing.mjs`: Mengukur waktu latensi endpoint agregasi broker harian.
- `test-latency.mjs`: Pengujian latensi jaringan ke API Sectors dan database terkelola.

---

## 4. Simulasi Prototipe (1 file)

Prototipe model kuantitatif sebelum diporting ke domain TypeScript:

- `run_gbm_simulation.py`: Prototipe Python awal untuk simulasi Geometric Brownian Motion intraday.

---

## 5. Pengujian Endpoint & Integrasi Provider (22 file)

Skrip pengujian integrasi langsung ke endpoint publik dan mock service:

- `test-180.mjs`: Uji coba jendela 180 hari perdagangan harian.
- `test-all-api-endpoints.mjs`: Uji pemanggilan ke seluruh endpoint Sectors v1.
- `test-apis.mjs`: Skrip tes komprehensif provider.
- `test-bmri.mjs`: Verifikasi pipeline data khusus ticker BMRI.
- `test-broker-activity.mjs`: Verifikasi parsing ringkasan broker top-3 buy/sell.
- `test-broker-service.mjs`: Uji service broker activity dengan filter tanggal.
- `test-company-report.mjs`: Uji penguraian company report dan rasio keuangan.
- `test-correct-endpoints.mjs`: Verifikasi URL endpoint Sectors yang valid.
- `test-db-connection.mjs`: Uji handshake database PostgreSQL.
- `test-db-error.mjs`: Uji penanganan error saat koneksi database ditutup.
- `test-endpoints-detail.mjs`: Uji detail respons HTTP status kode API.
- `test-endpoints.mjs`: Uji sanity endpoint dasar.
- `test-impact.mjs`: Uji rule-based evaluasi dampak berita.
- `test-lease-error.mjs`: Uji penanganan kegagalan lease lock.
- `test-lease.mjs`: Uji mekanisme distributed lease lock.
- `test-market-overview.mjs`: Uji agregasi data ringkasan pasar IHSG.
- `test-news.mjs`: Uji parsing feed berita dan pemetaan emiten.
- `test-ownership-section.mjs`: Uji parsing free float dan pemegang saham pengendali.
- `test-quarterly-array.mjs`: Uji data keuangan kuartalan berbasis array.
- `test-radar.mjs`: Uji deteksi katalis tidur (sleeping giants) pada radar feed.
- `test-screener-api.mjs`: Uji query filtering screener saham Sectors.
- `test-search.mjs`: Uji fungsionalitas autokomplit pencarian kode saham.

---

## 6. Verifikasi Historis & Audit (5 file)

Skrip verifikasi manual yang dijalankan pada audit audit awal:

- `fast-check.mjs`: Preflight check cepat sebelum commit.
- `verify-all-fixed.mjs`: Pemeriksaan regresi perbaikan audit awal.
- `verify-market-overview.mjs`: Verifikasi data overview pasar.
- `verify-sma-30.mjs`: Verifikasi kalkulasi Simple Moving Average 30 hari.
- `verify-sma.mjs`: Verifikasi kalkulasi SMA umum.

---

_Status: Terarsip dan terklasifikasi penuh per 23 September 2026._
