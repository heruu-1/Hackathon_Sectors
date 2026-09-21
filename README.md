# RASI — Report Analisis Saham Indonesia

**Ruang riset saham Indonesia** yang membantu pengguna menemukan saham, memahami data, memeriksa sumber, membandingkan, menyimpan pantauan, dan bertanya kepada Asisten Gemini.

Built with **Next.js 16**, **Drizzle ORM**, **PostgreSQL**, and **Tailwind CSS**.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 22.6 (termasuk untuk menjalankan tes TypeScript)
- **pnpm** ≥ 10 (recommended) or npm
- **PostgreSQL** database
- **Sectors API Key** — daftar di [sectors.app/api](https://sectors.app/api)

### 1. Clone Repository

```bash
git clone https://github.com/heruu-1/Hackathon_Sectors.git
cd Hackathon_Sectors
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Setup Environment Variables

Salin file `env.example` menjadi `.env.local`, lalu isi dengan kredensial Anda:

```bash
cp env.example .env.local
```

Buka `.env.local` dan edit nilainya:

```env
# URL koneksi PostgreSQL
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/rasi"

# API Key dari Sectors Financial API
SECTORS_API_KEY="your_sectors_api_key_here"

# Login Google dan Asisten Gemini
BETTER_AUTH_SECRET="replace-with-a-long-random-secret"
BETTER_AUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"
GEMINI_API_KEY="your_gemini_api_key_here"
```

> **Catatan:** File `.env.local` tidak akan ter-commit ke Git karena sudah ada di `.gitignore`. File `env.example` berfungsi sebagai template referensi yang aman untuk di-commit.

### 4. Setup Database

Pastikan PostgreSQL sudah berjalan. Untuk pengembangan lokal standar proyek ini, PostgreSQL berjalan di port **5433** (`.local/postgres`):

```bash
# Jalankan migrasi mandiri terstruktur (idempotent untuk fresh DB maupun existing)
node scripts/migrate.mjs

# Jalankan seeder untuk mengisi data snapshot awal (BBCA, TLKM, ASII, BBRI)
pnpm db:seed
```

> **Peringatan Produksi:** Jangan gunakan `drizzle-kit push` di lingkungan staging atau produksi. Selalu gunakan `node scripts/migrate.mjs` atau terapkan file SQL aditif di `drizzle/0002_rasi_v2_clean.sql`.

### 5. Run Development Server

```bash
pnpm dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

---

## 🧠 Fitur Unggulan (Intelligence Pillars)

RASI dirancang sebagai **Financial Intelligence Terminal** untuk mendeteksi pergerakan tidak wajar dan peluang tersembunyi di pasar saham Indonesia (IDX):

1. **Bandarmology & Big Money Flow Radar**:
   - Menghitung konsentrasi broker Top 3 (CR3) dan Top 5 (CR5) dari data _broker summary_ harian.
   - Mengidentifikasi status: `BIG_ACCUMULATION`, `NORMAL_ACCUMULATION`, `NEUTRAL`, `BIG_DISTRIBUTION`.
   - Mengukur arus dana asing (_Foreign Flow Net Inflow/Outflow_) dari transaksi investor asing (`f_bval`/`f_sval`), bukan sekadar kode broker asing.
   - Menghitung rata-rata harga beli broker terpilih, dengan label dan periode yang jelas.
   - Tabel Top 5 Pembeli vs Top 5 Penjual dengan badge Institusi, Retail (YP, XC, PD, dsb.), dan Asing.

2. **Radar Katalis Berita & AI Divergence ("Sleeping Giant Detector")**:
   - Menganalisis berita emiten secara real-time dengan Google Gemini AI terstruktur.
   - Mengukur skor dampak pasar (-100 hingga +100) dan klasifikasi katalis (Akuisisi, Laba, Dividen, Kontrak, dsb.).
   - Mendeteksi anomali **"Sleeping Giant"**: saham dengan katalis positif besar namun harganya belum bergerak naik (_unpriced catalyst_).
   - Mendeteksi **"Delayed Sell-off Hazard"**: saham dengan berita negatif berat namun harganya belum merespons koreksi.

3. **Deteksi Transaksi Insider yang Aneh**:
   - Memantau pelaporan kepemilikan orang dalam (_corporate filings_) dari BEI/KSEI.
   - Mendeteksi anomali:
     - 🚨 _Steep Discount Dump_: penjualan saham dengan diskon ekstrem di bawah harga pasar.
     - 💎 _Aggressive Insider Buy_: pembelian masif oleh direksi/pemegang saham pengendali.
     - ⚠️ _Massive Divestment_: pelepasan saham bernilai jumbo (> Rp 10 Miliar atau > 1%).

4. **Kesehatan Fundamental & Lonjakan Volume (_Volume Spike_)**:
   - Menghitung rasio lonjakan volume harian terhadap rata-rata volume 20 hari bursa (SMA-20, minimal 21 observasi sah).
   - Evaluasi kelayakan P/E dan P/B tahun terbaru.
   - Skor Risiko Komposit Terpadu 0–100 berbasis 4 pilar lengkap (Fundamental 25%, Broker 35%, Divergensi 25%, Insider 15%).

5. **Arsitektur Hemat Kuota (Quota Shield)**:
   - Caching pintar bertingkat (In-Memory LRU + PostgreSQL `api_cache` + distributed lease) untuk mengoptimalkan kuota Sectors API.
   - Rate limiting atomik berbasis PostgreSQL `quota_buckets` per menit dan per hari WIB.
   - Pemisahan operasi baca (`readStockData`) tanpa penulisan otomatis ke database atau pemborosan kuota AI.

---

## 📦 Environment Variables

| Variable               | Wajib di Prod | Deskripsi                                                   | Contoh                                  |
| ---------------------- | :-----------: | ----------------------------------------------------------- | --------------------------------------- |
| `DATABASE_URL`         |      Ya       | URL koneksi PostgreSQL.                                     | `postgresql://user:pass@host:5432/rasi` |
| `SECTORS_API_KEY`      |      Ya       | API Key dari Sectors Financial API.                         | `cde1971d...`                           |
| `GEMINI_API_KEY`       |      Ya       | API Key Google Gemini untuk analisis berita dan asisten.    | `AIzaSy...`                             |
| `GEMINI_MODEL`         |     Tidak     | Nama model percakapan server (default: `gemini-2.5-flash`). | `gemini-2.5-flash`                      |
| `BETTER_AUTH_SECRET`   |      Ya       | Secret sesi minimal 32 karakter; wajib diganti di produksi. | `random-secret-32-chars...`             |
| `BETTER_AUTH_URL`      |      Ya       | URL aplikasi yang dipakai OAuth callback.                   | `https://rasi.example.com`              |
| `GOOGLE_CLIENT_ID`     |      Ya       | Kredensial OAuth Google Client ID.                          | `...apps.googleusercontent.com`         |
| `GOOGLE_CLIENT_SECRET` |      Ya       | Kredensial OAuth Google Client Secret.                      | `GOCSPX-...`                            |

Periksa kelayakan variabel lingkungan sebelum deploy:

```bash
node scripts/check-env.mjs
```

---

## 🛠️ Tech Stack & Arsitektur

- **Framework:** Next.js 16 (App Router, Turbopack, Server Actions)
- **Database:** PostgreSQL + Drizzle ORM
- **Autentikasi:** Better Auth (Google OAuth)
- **Styling:** Tailwind CSS v4 + Framer Motion + Lucide React
- **API Data:** Sectors Financial API v2
- **AI Engine:** Google Gemini API (dengan rule-based fallback berlabel)

```text
Halaman / Komponen
        ↓
Server Action atau Route Handler (app/actions.ts, app/api/*)
        ↓
Validasi Input + Sesi (Zod contracts di lib/contracts/ & lib/auth.ts)
        ↓
Layanan Fitur (lib/server/services/)
        ↓
Repository & Provider (lib/server/repositories/ & lib/server/providers/)
        ↓
Indikator Murni (domain/)
        ↓
Data DTO Aman ke UI
```

---

## 🧪 Pengujian & Verifikasi

Proyek memiliki 60 tes unit otomatis yang mencakup kontrak data, sanitasi env, perhitungan indikator, isolasi akun, adapter provider, dan dedup idempotensi:

```powershell
# Jalankan seluruh test suites (60 tes)
pnpm test

# Jalankan typecheck, lint, format check, dan build
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

Endpoint pemantauan kesehatan aplikasi tersedia di:

- `GET /api/health` — memverifikasi status aplikasi, konektivitas database, uptime, dan latensi.

---

## 🏗️ Deployment (Vercel & Staging)

1. **Persiapan Database:**
   - Jalankan `node scripts/migrate.mjs` menggunakan `DATABASE_URL` staging/produksi.
   - Opsional: jalankan `node scripts/seed.mjs` jika ingin mengisi snapshot data awal.
2. **Konfigurasi Environment:**
   - Isi seluruh variabel wajib di Vercel Dashboard → Project Settings → Environment Variables.
   - Pastikan `BETTER_AUTH_URL` sesuai domain produksi dan `BETTER_AUTH_SECRET` memiliki panjang minimal 32 karakter acak.
3. **Deploy:**
   - Push ke branch `main`. CI GitHub Actions akan menjalankan linting, format check, typecheck, seluruh 60 unit tests, dan production build secara otomatis.
   - Vercel akan membangun dan meluncurkan aplikasi.
4. **Verifikasi Pasca-Deploy:**
   - Buka `https://<domain>/api/health` dan pastikan status `"ok"` dan database `"connected"`.
   - Uji login Google OAuth di `/masuk`.
   - Uji pencarian ticker saham (misal: BBCA, TLKM).
   - Uji penambahan saham ke Watchlist dan pembukaan percakapan di Asisten.

---

## 📝 License

Hak Cipta (c) 2026 RASI Team. Seluruh hak cipta dilindungi undang-undang.
