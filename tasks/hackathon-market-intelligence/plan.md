# Plan Final RASI — Platform Market Intelligence untuk Sectors Hackathon Kategori 3

## 1. Tujuan, cakupan, dan keputusan utama

**Bangun RASI menjadi platform riset saham Indonesia yang menghubungkan kondisi pasar, transaksi, fundamental, valuasi, kepemilikan, dan katalis menjadi kesimpulan yang dapat diperiksa buktinya.**

Plan ini menggantikan plan Radar Bukti sebelumnya. Radar tetap menjadi fitur utama, dengan cakupan analisis lebih lengkap.

Alur utama produk:

**Pahami pasar → temukan saham → periksa transaksi dan bisnis → bandingkan → simpan tesis riset → evaluasi perkembangannya.**

Kategori 3 mensyaratkan analisis turunan: sinyal, peringkat, screener dengan logika sendiri, deteksi anomali, perbandingan, atau sintesis riset. LLM opsional. Karena itu, seluruh analisis utama RASI harus tetap berjalan tanpa Gemini. [Ketentuan Market Intelligence](https://hackathon.sectors.app/tracks/market-intelligence)

### Keputusan yang dikunci

| Aspek          | Keputusan                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------ |
| Pengguna utama | Investor ritel Indonesia yang membutuhkan riset terstruktur dengan bahasa sederhana.       |
| Cakupan pasar  | Emiten IDX; data komoditas digunakan jika relevan dengan bisnis emiten.                    |
| Target fitur   | Seluruh 12 modul pada bagian berikut, dikerjakan berurutan.                                |
| Stack          | Pertahankan Next.js, TypeScript, PostgreSQL, Drizzle, Better Auth, dan pnpm.               |
| Sumber utama   | Sectors API v2.                                                                            |
| AI             | Gemini opsional untuk menjelaskan snapshot; tidak menentukan angka atau peringkat.         |
| Anggaran       | Maksimal 500 kredit tambahan; saldo aktual diperiksa saat implementasi.                    |
| Runtime        | Laptop lokal sebagai target wajib. Deployment publik tidak menjadi syarat penyelesaian.    |
| Akun           | Google untuk menyimpan data pribadi; pembacaan snapshot pasar dapat dilakukan tanpa login. |
| Penyajian      | Mode pemula dan detail; netral, ringkas, seluruh elemen interaktif berfungsi.              |
| Batas produk   | Analisis dan informasi; tanpa transaksi otomatis atau rekomendasi beli/jual personal.      |

**“Full fitur” berarti alur riset kategori 3 lengkap.** Analisis mendalam seluruh emiten setiap hari tidak dijanjikan dengan 500 kredit. Seluruh modul tersedia, tetapi pengambilan data mahal dilakukan sesuai kebutuhan dan cakupannya selalu ditampilkan.

Pasar Singapura/Malaysia, komunitas, simulasi trading, serta penelusuran seluruh izin pertambangan tidak termasuk target ini.

### Dasar implementasi

Kode yang ada sudah mencakup pencarian, detail saham, radar, screener, pembanding, watchlist, akun, dan asisten. Perluasan dilakukan di atas fondasi tersebut.

Prioritas koreksi sebelum menambahkan analisis:

- Samakan perhitungan perubahan harga setelah peristiwa pada radar dan detail.
- Pilih harga berdasarkan tanggal terbaru yang valid.
- Urutkan data broker sebelum memilih sesi.
- Perbaiki lease cache yang saat ini masih memungkinkan request upstream setelah gagal memperoleh lease.
- Perbaiki idempotensi agar request bersamaan tidak menjalankan pekerjaan dua kali.
- Satukan seluruh request Sectors melalui pengaman biaya.
- Pisahkan data Sectors untuk analisis dari kutipan provider lain pada asisten.
- Ganti penilaian fundamental berbasis ambang P/E/P/B universal dengan pembandingan yang sesuai kelompok perusahaan.

Plan ini belum merupakan implementasi. Tidak ada file proyek yang diubah dalam penyusunan plan.

## 2. Dua belas modul fitur

### F01 — Peta pasar dan sektor

**Pertanyaan:** “Apa yang sedang berubah di pasar, dan kelompok saham mana yang perlu diperhatikan?”

- Ringkasan saham naik, turun, tetap, serta tidak memiliki data pembanding.
- Distribusi perubahan harga dalam tabel dan heatmap.
- Filter sektor, subsektor, kapitalisasi, dan cakupan data.
- Median perubahan harga kelompok.
- Arus asing per sektor jika data emiten dan tanggalnya mencukupi.
- Daftar emiten penyumbang arus terbesar.
- Klik sektor membuka anggota kelompok; klik emiten membuka detail.

### F02 — Radar Bukti

**Pertanyaan:** “Apa yang layak diteliti, dan bukti apa yang saling bertentangan?”

- Alasan masuk radar.
- Bukti yang searah dan berbeda arah.
- Data yang belum tersedia.
- Periode pengamatan.
- Tautan sumber.
- Langkah riset berikutnya.

### F03 — Arus asing dan analisis broker

**Pertanyaan:** “Bagaimana perubahan transaksi pada saham ini?”

- Net asing satu, lima, dan dua puluh sesi.
- Jumlah sesi net buy/net sell.
- Grafik arus kumulatif.
- Broker pembeli dan penjual net terbesar.
- Pilihan net/gross.
- Konsentrasi top 3 dan top 5.
- Harga rata-rata transaksi broker terpilih.
- Perbandingan arah harga dan transaksi.

### F04 — Penelusuran broker

**Pertanyaan:** “Pada periode ini, broker tertentu paling banyak bertransaksi di saham apa?”

- Pencarian broker melalui registry resmi.
- Rentang satu atau lima sesi, dalam batas maksimal 14 hari kalender request.
- Peringkat saham berdasarkan net buy, net sell, dan gross transaksi.
- Pangsa masing-masing saham terhadap transaksi broker yang teramati.
- Perbandingan maksimal dua broker dalam periode sama.

### F05 — Fundamental dan perubahan kinerja

**Pertanyaan:** “Apakah kondisi bisnis membaik atau melemah?”

- Tren pendapatan, laba, margin, ekuitas, dan arus kas.
- Pertumbuhan dibanding periode sama tahun sebelumnya.
- Perubahan margin dalam poin persentase.
- Penanda laba positif tetapi arus kas operasi negatif untuk perusahaan nonkeuangan.
- Perubahan utang dan kemampuan menghasilkan kas.
- Tampilan khusus sektor keuangan (Bank vs Nonkeuangan vs Asuransi).

### F06 — Valuasi relatif dan pembanding emiten

**Pertanyaan:** “Bagaimana valuasi saham dibanding perusahaan sejenis?”

- P/E TTM, P/B MRQ, ROE, dividend yield, dan pertumbuhan yang tersedia.
- Median kelompok pembanding.
- Selisih terhadap median dan persentil.
- Perbandingan dua sampai tiga emiten.
- Pemilihan pembanding otomatis dari subsektor sama.
- Penanda “valuasi lebih rendah, tetapi kinerja melemah”.

### F07 — Kepemilikan, free float, dan filing

**Pertanyaan:** “Bagaimana struktur kepemilikan dan perubahan yang dilaporkan?”

- Pemegang saham utama.
- Free float beserta definisi sumber.
- Komposisi lokal/asing dan kategori investor.
- Perubahan komposisi antarbulan.
- Perubahan jumlah pemegang saham.
- Transaksi pemegang saham besar/insider.

### F08 — Katalis, aksi korporasi, dan riwayat suspensi

**Pertanyaan:** “Peristiwa apa yang perlu diperhitungkan sebelum membaca pergerakan harga?”

- Linimasa berita, filing, dan aksi korporasi.
- Dividen, split, rights issue, bonus saham.
- Riwayat suspensi (jika ada data).
- Perubahan harga setelah peristiwa pada sesi ke-1, ke-3, dan ke-5.

### F09 — Kekuatan relatif dan anomali perdagangan

**Pertanyaan:** “Apakah pergerakannya berbeda dari pasar?”

- Return 1, 5, 20 sesi vs IHSG.
- Relative volume terhadap 20 sesi sebelumnya.
- Volatilitas return harian pada jendela 20 sesi.
- Drawdown dalam jendela yang tersedia.

### F10 — Screener riset dan peringkat

**Pertanyaan:** “Bagaimana menemukan saham berdasarkan alasan riset tertentu?”

- 7 preset wajib.
- Filter draft/apply, sektor, periode.
- Simpan preset pribadi dan ekspor CSV.

### F11 — Peta bisnis dan eksposur komoditas

**Pertanyaan:** “Bisnis apa yang menghasilkan pendapatan, dan faktor eksternal apa yang relevan?”

- Segmen pendapatan & proporsi.
- Konsentrasi segmen terbesar.
- Hubungan emiten tambang dengan komoditas terverifikasi.

### F12 — Ruang riset, watchlist, dan evaluasi sinyal

**Pertanyaan:** “Apa kesimpulan sementara saya, dan apakah bukti kemudian berubah?”

- Brief riset: temuan, bukti pendukung, bukti berlawanan, keterbatasan.
- Tesis pribadi & kondisi pembatalan (invalidation trigger).
- Diff dua snapshot pada tanggal berbeda.
- Ekspor Markdown, CSV, halaman cetak.
- Evaluasi return 1, 3, 5 sesi setelah sinyal disimpan.

## 3. Kontrak data, perhitungan, arsitektur, dan anggaran

- Registry capability server-side dengan status: UNVERIFIED, AVAILABLE, FORBIDDEN, UNAVAILABLE.
- Two-tier scanning: Tier 1 discovery (maks 10 hal x 200 emiten), Tier 2 deep analysis (maks 8 kandidat).
- UTC di database, WIB di UI.
- Aturan rasi-mi-v2: R01 sampai R10.
- Anggaran 500 kredit: reservasi sebelum panggil API.
- Migrasi aditif: market_scans, research_snapshots, research_notes, saved_screens, signal_outcomes, api_usage, api_budgets.
