import type { DailyPriceRow } from '@/lib/contracts/market'

export function formatCurrencyIdr(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—'
  return `Rp ${val.toLocaleString('id-ID')}`
}

export function formatPercentageChange(fraction: number | null | undefined): {
  text: string
  trend: 'up' | 'down' | 'neutral'
} {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) {
    return { text: '0.00%', trend: 'neutral' }
  }
  const pct = fraction * 100
  const isUp = pct > 0
  const isDown = pct < 0
  return {
    text: `${isUp ? '+' : ''}${pct.toFixed(2)}%`,
    trend: isUp ? 'up' : isDown ? 'down' : 'neutral',
  }
}

export function formatDateWib(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Tanggal belum tersedia'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    })
  } catch {
    return dateStr
  }
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return 'Data belum cukup'
  }
  return `${Math.round(score)}/100`
}

export function getStatusLabel(status: string | null | undefined): {
  label: string
  variant: 'normal' | 'warning' | 'critical' | 'insufficient'
} {
  if (!status || status === 'INSUFFICIENT_DATA' || status === 'UNKNOWN') {
    return { label: 'Data belum cukup', variant: 'insufficient' }
  }
  if (status === 'CRITICAL' || status === 'BIG_DISTRIBUTION' || status === 'STEEP_DISCOUNT_DUMP') {
    return { label: status.replace(/_/g, ' '), variant: 'critical' }
  }
  if (status === 'WARNING' || status === 'NORMAL_DISTRIBUTION' || status === 'HIGH') {
    return { label: status.replace(/_/g, ' '), variant: 'warning' }
  }
  return { label: status.replace(/_/g, ' '), variant: 'normal' }
}

export const METRIC_EXPLANATIONS: Record<string, { short: string; detailed: string }> = {
  compositeScore: {
    short: 'Skor komposit indikator RASI berdasarkan 4 pilar analisis pasar.',
    detailed:
      'Skor gabungan dari Fundamental (25%), Broker (35%), Divergensi Berita (25%), dan Transaksi Orang Dalam (15%). Jika ada pilar data yang tidak lengkap, skor komposit tidak dihitung untuk mencegah kesimpulan prematur.',
  },
  volumeSpike: {
    short: 'Perbandingan volume transaksi sesi hari ini dengan rata-rata volume SMA-20.',
    detailed:
      'Lonjakan volume dihitung dari volume transaksi sesi terakhir dibagi rata-rata volume 20 sesi perdagangan sebelumnya. Memerlukan minimal 21 sesi observasi. Lonjakan >= 1.5x menandakan aktivitas pasar yang signifikan.',
  },
  peRatio: {
    short: 'Rasio harga saham terhadap laba bersih per saham (Price to Earnings).',
    detailed:
      'Menunjukkan valuasi saham dibandingkan laba tahunan yang dihasilkan perusahaan. Angka P/E yang rendah perlu diperiksa bersama stabilitas laba dan rata-rata industrinya.',
  },
  pbRatio: {
    short: 'Rasio harga saham terhadap nilai buku ekuitas (Price to Book).',
    detailed:
      'Membandingkan kapitalisasi pasar perusahaan dengan total nilai buku aset bersihnya. Umumnya digunakan untuk menilai perbankan, manufaktur, dan properti.',
  },
  bandarmology: {
    short: 'Analisis konsentrasi transaksi broker pembeli dan penjual terbesar.',
    detailed:
      'Mengukur apakah transaksi broker teratas (CR3 dan CR5) terkonsentrasi pada akumulasi atau distribusi, serta memisahkan arus transaksi investor asing secara mandiri.',
  },
  divergence: {
    short: 'Pemeriksaan apakah berita penting sudah tercermin pada pergerakan harga.',
    detailed:
      'Divergensi terjadi bila emiten memiliki berita katalis positif yang signifikan namun harga sahamnya belum bergerak naik (kondisi Sleeping Giant), atau sebaliknya.',
  },
  insider: {
    short: 'Pelaporan resmi transaksi saham oleh direksi, komisaris, atau pengendali emiten.',
    detailed:
      'Memantau apakah orang dalam perusahaan melakukan pembelian agresif atau penjualan diskon besar yang berpotensi menjadi sinyal kondisi internal perusahaan.',
  },
}

/**
 * Calculates SMA-20 for a given series of daily price rows.
 * Requires at least 21 valid chronological rows.
 * Returns an array corresponding to the input rows, where indices before 20 are null.
 */
export function calculatePriceSma20(rows: DailyPriceRow[]): (number | null)[] {
  if (!rows || rows.length < 21) {
    return rows ? rows.map(() => null) : []
  }

  const result: (number | null)[] = []
  for (let i = 0; i < rows.length; i++) {
    if (i < 20) {
      result.push(null)
    } else {
      const window = rows.slice(i - 20, i)
      const sum = window.reduce((acc, r) => acc + r.close, 0)
      result.push(Math.round(sum / 20))
    }
  }
  return result
}
