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
    return { text: '—', trend: 'neutral' }
  }
  const pct = fraction * 100
  const isUp = pct > 0
  const isDown = pct < 0
  return {
    text: `${isUp ? '+' : ''}${pct.toFixed(2)}%`,
    trend: isUp ? 'up' : isDown ? 'down' : 'neutral',
  }
}

export function formatForeignFlow(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—'
  if (val > 0) return `Beli bersih Rp ${val.toLocaleString('id-ID')}`
  if (val < 0) return `Jual bersih Rp ${Math.abs(val).toLocaleString('id-ID')}`
  return 'Beli dan jual seimbang (Rp 0)'
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
  const labels: Record<string, string> = {
    NORMAL: 'Belum ada peringatan khusus',
    WARNING: 'Perlu diperiksa',
    HIGH: 'Perlu lebih berhati-hati',
    CRITICAL: 'Ada peringatan penting',
    BIG_ACCUMULATION: 'Pembelian besar melalui broker utama',
    NORMAL_ACCUMULATION: 'Pembelian lebih menonjol',
    BIG_DISTRIBUTION: 'Penjualan besar melalui broker utama',
    NORMAL_DISTRIBUTION: 'Penjualan lebih menonjol',
    NEUTRAL: 'Relatif seimbang',
    HEAVY_INFLOW: 'Pembelian asing jauh lebih besar',
    INFLOW: 'Asing lebih banyak membeli',
    OUTFLOW: 'Asing lebih banyak menjual',
    HEAVY_OUTFLOW: 'Penjualan asing jauh lebih besar',
    SLEEPING_GIANT: 'Berita positif, harga belum banyak naik',
    PRICED_IN_RALLY: 'Harga sudah naik setelah berita',
    DELAYED_SELL_OFF_RISK: 'Berita negatif, harga belum banyak turun',
    NORMAL_REACTION: 'Tidak ada perbedaan mencolok',
    NO_PRICE_RESPONSE: 'Harga setelah berita terbit belum tersedia',
    NO_CATALYST: 'Belum ada berita penting',
    STEEP_DISCOUNT_DUMP: 'Penjualan jauh di bawah harga pasar',
    MASSIVE_DIVESTMENT: 'Penjualan saham dalam jumlah besar',
    AGGRESSIVE_BUY: 'Pembelian saham dalam jumlah besar',
    CONGLOMERATE_SHUFFLE: 'Perpindahan saham dalam satu grup',
    ROUTINE_TRANSACTION: 'Transaksi biasa',
    NO_RECENT_FILINGS: 'Belum ada laporan transaksi terbaru',
    WATCHING: 'Sedang dipantau',
    ACCUMULATING: 'Menambah saham',
    BOUGHT: 'Sudah dibeli',
    LOW: 'Rendah',
  }
  const label = labels[status] ?? 'Belum ada penjelasan'
  if (status === 'CRITICAL' || status === 'BIG_DISTRIBUTION' || status === 'STEEP_DISCOUNT_DUMP') {
    return { label, variant: 'critical' }
  }
  if (status === 'WARNING' || status === 'NORMAL_DISTRIBUTION' || status === 'HIGH') {
    return { label, variant: 'warning' }
  }
  return { label, variant: 'normal' }
}

export function getNewsSentimentLabel(sentiment?: string | null): string {
  return (
    ({ BULLISH: 'Positif', BEARISH: 'Negatif', NEUTRAL: 'Netral' } as Record<string, string>)[
      sentiment ?? ''
    ] ?? 'Belum dinilai'
  )
}

export function getNewsCategoryLabel(category?: string | null): string {
  return (
    (
      {
        ACQUISITION: 'Pembelian perusahaan',
        DIVIDEND: 'Pembagian dividen',
        EARNINGS: 'Laba dan pendapatan',
        CONTRACT_WIN: 'Kontrak bisnis',
        DEBT: 'Utang perusahaan',
        GENERAL: 'Berita umum',
      } as Record<string, string>
    )[category ?? ''] ?? 'Berita lainnya'
  )
}

export function getSectorLabel(sector?: string | null): string {
  return (
    (
      {
        'Basic Materials': 'Bahan baku',
        'Consumer Cyclicals': 'Barang konsumen nonpokok',
        'Consumer Non-Cyclicals': 'Barang kebutuhan pokok',
        Energy: 'Energi',
        Financials: 'Keuangan',
        Healthcare: 'Kesehatan',
        Industrials: 'Perindustrian',
        Infrastructures: 'Infrastruktur',
        'Properties & Real Estate': 'Properti',
        Technology: 'Teknologi',
        'Transportation & Logistic': 'Transportasi dan logistik',
        Telecommunication: 'Telekomunikasi',
      } as Record<string, string>
    )[sector ?? ''] ??
    sector ??
    'Belum tersedia'
  )
}

export const METRIC_EXPLANATIONS: Record<string, { short: string; detailed: string }> = {
  compositeScore: {
    short: 'Skor gabungan dari keuangan perusahaan, transaksi, dan berita.',
    detailed:
      'Skor memakai data keuangan (25%), transaksi broker (35%), berita dan perubahan harga (25%), serta transaksi pengurus dan pemegang saham besar (15%). Jika ada data yang belum lengkap, skor belum dihitung. Skor bukan perkiraan keuntungan.',
  },
  volumeSpike: {
    short: 'Jumlah saham yang diperdagangkan dibanding rata-rata 20 hari bursa sebelumnya.',
    detailed:
      'Jumlah lembar saham pada hari bursa terakhir dibagi rata-rata 20 hari sebelumnya. Angka 1,5x berarti 50% lebih banyak dari biasanya. Perhitungan ini membutuhkan data 21 hari perdagangan.',
  },
  peRatio: {
    short: 'Harga satu saham dibanding laba bersih per saham (P/E).',
    detailed:
      'P/E 10x berarti harga saham sepuluh kali laba tahunan per saham. Angka rendah belum tentu murah: periksa apakah labanya stabil dan bandingkan dengan perusahaan sejenis.',
  },
  pbRatio: {
    short: 'Harga saham dibanding aset bersih per saham dalam laporan keuangan (P/B).',
    detailed:
      'Aset bersih adalah aset perusahaan setelah dikurangi utang. P/B 2x berarti harga saham dua kali aset bersih per saham menurut laporan keuangan, bukan harga jual seluruh asetnya.',
  },
  bandarmology: {
    short: 'Porsi pembelian dan penjualan melalui broker terbesar.',
    detailed:
      'CR3 adalah porsi transaksi melalui 3 broker terbesar; CR5 memakai 5 broker. Porsi beli dan jual dibandingkan untuk melihat pola transaksi. Data ini tidak menunjukkan siapa semua nasabah broker tersebut.',
  },
  divergence: {
    short: 'Perbandingan isi berita dengan perubahan harga saham.',
    detailed:
      'RASI mencari berita positif yang belum diikuti kenaikan harga besar, atau berita negatif yang belum diikuti penurunan besar. Perbedaan ini perlu diperiksa; harga belum tentu akan mengikuti berita.',
  },
  insider: {
    short: 'Laporan jual beli saham oleh pengurus dan pemegang saham pengendali.',
    detailed:
      'Lihat siapa yang membeli atau menjual, jumlah saham, serta harga transaksinya. Transaksi besar tidak otomatis menunjukkan perusahaan sedang baik atau buruk.',
  },
}

/**
 * Calculates SMA-20 for a given series of daily price rows.
 * Includes the current session; the first 19 entries have insufficient history.
 */
export function calculatePriceSma20(rows: DailyPriceRow[]): (number | null)[] {
  if (!rows || rows.length < 20) {
    return rows ? rows.map(() => null) : []
  }

  const result: (number | null)[] = []
  for (let i = 0; i < rows.length; i++) {
    if (i < 19) {
      result.push(null)
    } else {
      const window = rows.slice(i - 19, i + 1)
      const sum = window.reduce((acc, r) => acc + r.close, 0)
      result.push(sum / 20)
    }
  }
  return result
}
