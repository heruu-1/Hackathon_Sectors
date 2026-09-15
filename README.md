# RASI — Report Analisis Saham Indonesia

**Sistem Deteksi Anomali Saham ("Radar Saham Gorengan")** yang menarik data fundamental dari [Sectors API](https://sectors.app) dan mendeteksi pergerakan saham yang tidak wajar di pasar IDX.

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
```

> **Catatan:** File `.env.local` tidak akan ter-commit ke Git karena sudah ada di `.gitignore`. File `env.example` berfungsi sebagai template referensi yang aman untuk di-commit.

### 4. Setup Database

Pastikan PostgreSQL sudah berjalan, lalu buat database `rasi`:

```bash
createdb rasi
```

Jalankan migrasi schema ke database:

```bash
pnpm drizzle-kit push
```

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
   - Mengukur arus dana asing (_Foreign Flow Net Inflow/Outflow_) menggunakan registry 88 broker IDX.
   - Menghitung estimasi harga modal rata-rata bandar (_Bandar Avg Cost_) vs harga pasar saat ini.
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
   - Menghitung rasio lonjakan volume harian terhadap rata-rata volume 20 hari bursa (SMA-20).
   - Evaluasi kelayakan P/E dan P/B tahun terbaru.
   - Skor Risiko Komposit Terpadu 0–100.

5. **Arsitektur Hemat Kuota (Quota Shield)**:
   - Caching pintar bertingkat (In-Memory + PostgreSQL `api_cache`) untuk mengoptimalkan kuota Sectors API (500–1.000 kredit).
   - Memindai seluruh pasar melalui batch feed berita dan filings tanpa membebani kuota API.

---

## 📦 Environment Variables

| Variable          | Deskripsi                                                                                                               | Contoh                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `DATABASE_URL`    | URL koneksi PostgreSQL. Digunakan oleh Drizzle ORM untuk menyimpan riwayat analisis dan cache API.                      | `postgresql://postgres:pass@localhost:5432/rasi` |
| `SECTORS_API_KEY` | API Key dari Sectors Financial API. Digunakan untuk data broker summary, transaksi harian, berita, dan insider filings. | `cde1971d...`                                    |
| `GEMINI_API_KEY`  | _(Opsional)_ API Key Google Gemini untuk analisis sentimen & dampak berita terstruktur. Gratis di Google AI Studio.     | `AIzaSy...`                                      |

Lihat file [`env.example`](env.example) untuk template lengkap beserta penjelasan setiap variabel.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (Turbopack, App Router, Server Actions)
- **Database:** PostgreSQL + Drizzle ORM
- **Styling:** Tailwind CSS v4
- **Animation:** Framer Motion
- **Icons:** Lucide React
- **API:** Sectors Financial API v2
- **AI Engine:** Google Gemini API (dengan rule-based NLP fallback)

---

## 📁 Project Structure

```
hackathon/
├── app/
│   ├── actions.ts       # Server actions (fetch multi-endpoint & pipeline intelejen)
│   ├── layout.tsx       # Root layout + SEO metadata
│   └── page.tsx         # Dashboard Fintech Intelligence Terminal (3 Tabs)
├── db/
│   ├── index.ts         # Koneksi database (Drizzle + postgres)
│   └── schema.ts        # Schema tabel anomalies & api_cache
├── lib/
│   ├── bandarmology.ts  # Engine Bandarmology (CR3/CR5, Foreign Flow, Volume Spike)
│   ├── divergence.ts    # Engine Sleeping Giant & Catalyst Divergence
│   ├── gemini.ts        # Integrasi Gemini AI terstruktur & Rule-based fallback
│   ├── insider.ts       # Deteksi transaksi orang dalam tidak wajar
│   ├── sectors.ts       # Sectors API client v2 & memory/DB caching layer
│   └── utils.ts         # Helper utilities (cn)
├── tests/
│   ├── intelligence.test.mjs # Unit tests kalkulasi Bandarmology, Divergensi & Insider
│   └── sectors.test.mjs      # Unit tests Sectors API & scoring
├── drizzle.config.ts    # Konfigurasi Drizzle Kit
├── env.example          # Template environment variables
└── .env.local           # Environment variables lokal
```

---

## 🧪 Pengujian & Verifikasi

Proyek dilengkapi dengan pengujian unit otomatis komprehensif (20 tests):

```powershell
corepack pnpm test
corepack pnpm lint
corepack pnpm build
```

---

## 🏗️ Build & Deploy

### Production Build

```bash
pnpm build
pnpm start
```

### Deploy ke Vercel

1. Push repository ke GitHub.
2. Import project di [vercel.com](https://vercel.com).
3. Tambahkan environment variables (`DATABASE_URL`, `SECTORS_API_KEY`) di Vercel Dashboard → Settings → Environment Variables.
4. Deploy otomatis setiap push ke branch `main`.

### Deploy ke VPS / Server

```bash
git clone https://github.com/YOUR_USERNAME/hackathon.git
cd hackathon
pnpm install
cp env.example .env.local
# Edit .env.local dengan kredensial production
pnpm drizzle-kit push
pnpm build
pnpm start
```

---

## 📝 License

Lisensi proyek belum ditentukan. Jangan menggunakan, menyalin, atau mendistribusikan kode ini sebelum lisensi ditambahkan.
