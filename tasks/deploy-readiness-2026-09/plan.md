# Rencana Final Kesiapan Deploy RASI

## 1. Ringkasan audit dan keputusan

Audit read-only telah mencakup seluruh **23 commit** yang dapat dijangkau pada branch `main`, termasuk diff commit besar, konfigurasi, migrasi, API, autentikasi, simulasi sinyal, dokumentasi, dan status CI.

Baseline terverifikasi pada HEAD `78fcbe8e71e5559b0d80034dd3d08d24df09cc90`:

- Worktree bersih dan sama dengan `origin/main`.
- Lima workflow GitHub Actions terakhir gagal; workflow HEAD gagal pada pemeriksaan format.
- `format:check`: gagal, 49 file belum sesuai.
- `lint`: gagal, 2 error dan 22 warning.
- `typecheck`: lulus.
- Test: 176/176 lulus setelah dijalankan di luar keterbatasan sandbox.
- Production build Next.js 16.3.4: lulus.
- Audit dependency produksi: tidak menemukan kerentanan yang diketahui.
- PostgreSQL lokal tidak tersedia, sehingga migrasi, integritas schema, OAuth, dan alur browser belum terbukti.
- Pengujian browser/DevTools belum dapat dilakukan pada sesi audit ini.
- Beberapa checklist lama menyatakan selesai, tetapi buktinya sudah tidak cocok dengan kondisi HEAD.

**Keputusan deploy: belum layak deploy.** Penghambat utama adalah rantai migrasi yang tidak lengkap, fallback data pengguna yang fail-open, identitas tamu bersama, kesalahan simulasi sinyal, kalender bursa tidak lengkap, feature flag yang belum diterapkan, klaim data “real-time” yang tidak terbukti, dan CI merah.

Target akhir: **Vercel + PostgreSQL terkelola**, rollout bertahap, tanpa mengganti stack utama.

---

## 2. Aturan wajib untuk AI pelaksana

1. Buat branch `fix/deploy-readiness`; jangan bekerja langsung pada `main`.
2. Jangan menggunakan `git reset --hard`, force-push, menghapus migrasi lama, atau menghapus `scratch/` tanpa bukti referensi.
3. Sebelum mengubah kode Next.js, baca dokumentasi lokal berikut secara lengkap:
   - `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`
   - `data-security.md`
   - `content-security-policy.md`
   - `production-checklist.md`
   - `environment-variables.md`
   - `authentication.md`
   - `01-getting-started/15-route-handlers.md`
4. Buat folder baru `tasks/deploy-readiness-2026-09/` berisi:
   - `plan.md`: salinan rencana ini.
   - `todo.md`: checklist per tugas, awalnya belum dicentang.
   - `verification.md`: command, exit code, hasil, waktu, commit, dan keterbatasan.
5. Jangan mengubah checklist lama menjadi seolah-olah verifikasi baru. Tandai dokumen lama sebagai bukti historis bila dirujuk.
6. Setiap perubahan logika harus memakai urutan red–green–refactor: tes gagal yang membuktikan bug, perbaikan minimal, lalu refactor.
7. Maksimal satu tema per commit. Pisahkan perubahan format massal dari perubahan logika.
8. Jangan menonaktifkan aturan ESLint, TypeScript, autentikasi, atau validasi hanya agar CI hijau.
9. Jangan mengklaim “real-time”, “live”, “pasti”, atau “siap deploy” tanpa bukti runtime.
10. Hentikan pekerjaan dan laporkan jika:
    - Worktree memiliki perubahan tak dikenal.
    - Checksum migrasi produksi berbeda.
    - Backup/restore belum terbukti.
    - Perbaikan memerlukan penghapusan data.
    - Kontrak atau legalitas provider tidak dapat dipastikan.
    - Secret nyata ditemukan dalam histori Git.

---

## 3. Urutan implementasi

### Tahap A — Kunci baseline dan pulihkan CI

- A1. Dokumentasikan baseline
- A2. Perbaiki format dan lint
- A3. Perbaiki workflow CI

### Tahap B — Migrasi database yang aman dan deterministik

- B1. Satukan runner migrasi
- B2. Tambahkan verifikasi schema
- B3. Strategi produksi

### Tahap C — Konfigurasi dan feature flag yang benar-benar bekerja

- C1. Jadikan konfigurasi satu sumber kebenaran
- C2. Terapkan flag di batas server
- C3. Tambahkan predeploy

### Tahap D — Tutup celah autentikasi, isolasi pengguna, dan privasi

- D1. Hilangkan identitas tamu bersama
- D2. Ubah repository percakapan menjadi fail-closed
- D3. Tutup open redirect
- D4. Keraskan Better Auth
- D5. Validasi semua input dan keluaran error
- D6. CSP dan privacy

### Tahap E — Perbaiki kebenaran simulasi sinyal

- E1. Definisikan kontrak produk
- E2. Perbaiki kalender dan sesi perdagangan
- E3. Bangun timeline simulasi kanonis
- E4. Perbaiki state machine posisi
- E5. Sensitivitas dan determinisme
- E6. Kualitas data intraday
- E7. Batas performa

### Tahap F — Provider, kesehatan sistem, dan kebenaran klaim

- F1. Provider envelope bersama
- F2. Pisahkan liveness dan readiness
- F3. Observabilitas

### Tahap G — Rapikan arsitektur tanpa rewrite besar

- G1. Pecah `app/actions.ts` menurut fitur
- G2. Pecah komponen besar (`StockDetail`)
- G3. Kanonisasi kode & klasifikasi `scratch/`
