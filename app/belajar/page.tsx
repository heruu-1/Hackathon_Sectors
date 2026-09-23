import Link from 'next/link'

import { BookOpen, Info } from 'lucide-react'

const lessons = [
  [
    'Harga dibanding laba dan aset perusahaan',
    'P/E membandingkan harga saham dengan laba per saham. P/B membandingkannya dengan aset bersih per saham dalam laporan keuangan. Angka rendah belum tentu murah; bandingkan dengan perusahaan sejenis.',
  ],
  [
    'Lebih banyak membeli atau menjual',
    'Akumulasi berarti menambah saham, distribusi berarti menjual saham. Data broker menunjukkan transaksi melalui perusahaan sekuritas, bukan identitas semua pembeli dan penjual.',
  ],
  [
    'Lonjakan jumlah saham yang diperdagangkan',
    'Volume adalah jumlah lembar saham yang diperdagangkan. Angka 2x berarti jumlahnya dua kali rata-rata 20 hari bursa sebelumnya. Banyak transaksi belum tentu berarti harga akan naik.',
  ],
  [
    'Transaksi orang dalam',
    'Ini adalah laporan jual beli saham oleh direksi, komisaris, atau pemegang saham besar. Transaksi tersebut tidak otomatis berarti ada pelanggaran.',
  ],
  [
    'Skor RASI',
    'Skor ini merangkum hal yang perlu diperiksa dari laporan keuangan, transaksi, dan berita. Angkanya bukan perkiraan keuntungan atau petunjuk membeli saham.',
  ],
]

export default function LearnPage() {
  return (
    <div className="space-y-6 py-4">
      <div className="border-b border-[var(--rasi-border)] pb-4">
        <p className="text-sm font-semibold text-[var(--rasi-primary)]">Belajar Saham</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--rasi-text)] sm:text-3xl">
          Kenali istilah yang sering muncul
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--rasi-muted)]">
          Penjelasan singkat untuk membantu Anda membaca data saham. Anda juga bisa membuka “Apa
          artinya?” di halaman saham.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lessons.map(([title, text]) => (
          <article
            key={title}
            className="flex flex-col justify-between rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-card)] p-5 shadow-[var(--rasi-card-shadow)]"
          >
            <div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[var(--rasi-primary)]" />
                <h2 className="font-semibold text-[var(--rasi-text)]">{title}</h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[var(--rasi-muted)]">{text}</p>
            </div>
            <Link
              href="/asisten"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--rasi-accent)] hover:underline"
            >
              <Info className="h-3.5 w-3.5" /> Tanyakan ke AI
            </Link>
          </article>
        ))}
      </div>
    </div>
  )
}
