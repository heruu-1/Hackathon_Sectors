# RASI follow-up sebelum staging/public release

- [ ] Isi `DATABASE_URL`, OAuth Google, Sectors, dan Gemini pada environment staging.
- [ ] Jalankan dan tinjau `drizzle/0001_rasi_auth_and_watchlist.sql` pada database staging.
- [ ] Uji dua akun Google: watchlist, update, delete, riwayat, dan percakapan tidak boleh silang.
- [ ] Ganti rate limit Asisten process-local dengan penghitung PostgreSQL atomik per akun/hari WIB.
- [ ] Persist conversation/message snapshot dan sediakan hapus percakapan.
- [ ] Tambahkan seri harga harian tervalidasi, Lightweight Charts, SMA, dan tabel aksesibel.
- [ ] Tambahkan fixture status `ready/partial/empty/unavailable/error` per provider.
- [ ] Tambahkan Playwright E2E dan audit keyboard pada viewport 320/390/768/1024/1440.
- [ ] Verifikasi OAuth, API Sectors, model Gemini, atribusi library, dan hak penyajian ulang di staging.
- [ ] Jalankan `corepack pnpm build` di CI/host yang mengizinkan child process; sandbox Windows saat ini gagal pada `spawn EPERM`.
