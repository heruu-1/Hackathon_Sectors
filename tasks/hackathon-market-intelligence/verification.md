# Protokol Verifikasi RASI Market Intelligence

## Command Verifikasi Standar

```powershell
corepack pnpm typecheck
corepack pnpm test
corepack pnpm lint
corepack pnpm format:check
corepack pnpm build
git diff --check
```

Target setiap command adalah exit `0`.

## Tes Terfokus

```powershell
node --experimental-strip-types tests/<nama-test>.test.mjs
```

## Checklist Verifikasi Area

1. **Kontrak provider:** Respons benar, field hilang, tipe salah, null, kosong, skema tidak terduga.
2. **Periode:** Akhir pekan, urutan tanggal acak, duplikat, timezone, sesi berjalan.
3. **Harga & Benchmark:** Tanggal berbeda, harga 0, aksi korporasi, observasi < 21.
4. **Flow & Broker:** Net 0, konversi lot, investor asing via broker lokal.
5. **Fundamental:** Laba negatif, pembanding 0, kuartal hilang, basis YTD vs standalone.
6. **Valuasi:** Peers < 5, P/E negatif, P/B ekuitas negatif, ties persentil.
7. **Kepemilikan:** Denominator berubah, bulan kosong, % > 100%.
8. **Katalis & Filing:** Multi-ticker, berita tanpa ticker, tag kontradiktif, repo/transfer.
9. **Anggaran:** Biaya per section/kuartal, reservasi atomik, timeout, budget habis.
10. **Snapshot:** Idempotensi, hasil tidak berubah, catatan pribadi tidak bocor.
11. **Outcome:** Horizon belum matang (pending), harga hilang, corporate action.
12. **Ekspor:** CSV formula injection disanitasi, format konsisten dengan UI.
