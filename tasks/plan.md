# RASI implementation handoff

## Sudah dipasang

- Route riset: `/saham`, `/saham/[ticker]`, `/screener`, `/radar`, `/bandingkan`, `/watchlist`, `/riwayat`, `/belajar`, `/asisten`, `/pengaturan`, dan `/masuk`.
- Shell navigasi responsif, skip link, focus-visible, tema sistem/terang/gelap, dan mode pemula.
- Pencarian saham dengan debounce, dropdown hasil, loading, empty, dan error.
- Screener Sectors berhalaman 25 baris, URL filter, preset ukuran/dividen/pertumbuhan/valuasi.
- Watchlist dengan kepemilikan akun, deduplikasi `(userId, ticker)`, error tetap membuka modal, dan konfirmasi aksi Asisten.
- Better Auth Google OAuth, schema Drizzle, handler Next.js, dan migrasi SQL aditif.
- Cache Sectors memakai PostgreSQL `api_cache` bila database tersedia.
- Provenance analisis Gemini/aturan disimpan pada snapshot; pembanding harga buatan radar dan insider dihapus.

## Verifikasi yang dipakai

- `corepack pnpm exec tsc --noEmit --incremental false`
- `corepack pnpm lint`
- `corepack pnpm format:check`
- Fixture langsung `tests/intelligence.test.mjs` dan `tests/sectors.test.mjs`
