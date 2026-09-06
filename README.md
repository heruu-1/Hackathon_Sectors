# RASI — Report Analisis Saham Indonesia

**Sistem Deteksi Anomali Saham ("Radar Saham Gorengan")** yang menarik data fundamental dari [Sectors API](https://sectors.app) dan mendeteksi pergerakan saham yang tidak wajar di pasar IDX.

Built with **Next.js 16**, **Drizzle ORM**, **PostgreSQL**, and **Tailwind CSS**.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
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

## 📦 Environment Variables

| Variable          | Deskripsi                                                                                                                       | Contoh                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `DATABASE_URL`    | URL koneksi PostgreSQL. Digunakan oleh Drizzle ORM untuk menyimpan riwayat analisis anomali saham.                              | `postgresql://postgres:pass@localhost:5432/rasi` |
| `SECTORS_API_KEY` | API Key dari Sectors Financial API. Digunakan untuk mengambil data fundamental perusahaan IDX (valuasi, laporan keuangan, dll). | `cde1971d...`                                    |

Lihat file [`env.example`](env.example) untuk template lengkap beserta penjelasan setiap variabel.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router, Server Actions)
- **Database:** PostgreSQL + Drizzle ORM
- **Styling:** Tailwind CSS v4
- **Animation:** Framer Motion
- **Icons:** Lucide React
- **API:** Sectors Financial API v2

---

## 📁 Project Structure

```
hackathon/
├── app/
│   ├── actions.ts       # Server actions (fetch API & insert DB)
│   ├── layout.tsx        # Root layout + SEO metadata
│   └── page.tsx          # Halaman utama dashboard
├── db/
│   ├── index.ts          # Koneksi database (Drizzle + postgres)
│   └── schema.ts         # Schema tabel anomalies
├── lib/
│   └── utils.ts          # Helper utilities (cn)
├── drizzle.config.ts     # Konfigurasi Drizzle Kit
├── env.example           # Template environment variables
└── .env.local            # Environment variables (tidak di-commit)
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
