import Link from 'next/link'

import { BookOpen, Info } from 'lucide-react'

const lessons = [
  [
    'P/E dan P/B',
    'Dua cara melihat harga saham dibandingkan laba atau nilai bukunya. Angka yang lebih rendah tidak otomatis lebih baik; bandingkan dengan sektor dan periode yang sama.',
  ],
  [
    'Akumulasi dan distribusi',
    'Ringkasan arus beli dan jual melalui broker. Konsentrasi tinggi adalah sinyal untuk diperiksa, bukan bukti siapa yang mengendalikan pasar.',
  ],
  [
    'Volume spike',
    'Volume hari ini dibandingkan rata-rata hari sebelumnya. Lonjakan perlu dibaca bersama berita, harga, dan likuiditas.',
  ],
  [
    'Transaksi orang dalam',
    'Pelaporan perubahan kepemilikan oleh orang dalam atau pemegang saham besar. Data ini bukan bukti pelanggaran dengan sendirinya.',
  ],
  [
    'Skor RASI',
    'Indikator perhatian yang menggabungkan beberapa sinyal. Skor bukan probabilitas keuntungan, prediksi harga, atau rekomendasi transaksi.',
  ],
]

export default function LearnPage() {
  return (
    <section className="max-w-4xl py-4">
      <p className="text-sm font-semibold text-[var(--rasi-primary)]">Belajar saham</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        Baca laporan tanpa harus menghafal semua istilah
      </h1>
      <p className="mt-3 max-w-2xl leading-7 text-[var(--rasi-muted)]">
        Setiap definisi di sini juga tersedia langsung di halaman detail saham. Mulai dari konsep
        yang paling sering muncul dalam riset.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {lessons.map(([title, text]) => (
          <article
            key={title}
            className="rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-5"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[var(--rasi-primary)]" />
              <h2 className="font-semibold">{title}</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--rasi-muted)]">{text}</p>
            <Link
              href="/asisten"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--rasi-primary)] hover:underline"
            >
              <Info className="h-3.5 w-3.5" /> Tanyakan ke AI
            </Link>
          </article>
        ))}
      </div>
    </section>
  )
}
