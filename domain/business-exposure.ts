/**
 * Domain module for business segments, revenue concentration,
 * and verified commodity exposures (F11).
 */
import type { RawSegmentItem } from '../lib/server/providers/segments.ts'
import { normalizeTicker } from './ticker.ts'

export interface RevenueSegment {
  name: string
  value: number | null
  percentage: number | null
}

export interface CommodityExposure {
  commodityName: string
  relationship: string // e.g. "Produsen Batubara Termal", "Penambang & Pemurnian Nikel"
  verificationStatus: 'VERIFIED' | 'UNVERIFIED'
  sourceNote: string
}

export interface BusinessExposureAnalysis {
  symbol: string
  companyName: string
  segments: RevenueSegment[]
  largestSegment: {
    name: string
    percentage: number | null
  } | null
  concentrationLevel: 'HIGH' | 'MODERATE' | 'DIVERSIFIED' | 'UNKNOWN'
  commodityExposures: CommodityExposure[]
  summary: string
}

const VERIFIED_COMMODITY_MAP: Record<
  string,
  Array<{ commodityName: string; relationship: string }>
> = {
  ADRO: [{ commodityName: 'Batubara', relationship: 'Penambangan & perdagangan batubara termal' }],
  PTBA: [{ commodityName: 'Batubara', relationship: 'Penambangan batubara BUMN' }],
  ITMG: [{ commodityName: 'Batubara', relationship: 'Penambangan & ekspor batubara' }],
  BUMI: [
    {
      commodityName: 'Batubara',
      relationship: 'Produsen batubara terbesar Indonesia (KPC & Arutmin)',
    },
  ],
  BYAN: [{ commodityName: 'Batubara', relationship: 'Produsen batubara termal rendah sulfur' }],
  INDY: [
    { commodityName: 'Batubara', relationship: 'Penambangan batubara & diversifikasi energi' },
  ],
  HRUM: [
    { commodityName: 'Batubara', relationship: 'Penambangan batubara' },
    { commodityName: 'Nikel', relationship: 'Penambangan & pengolahan nikel' },
  ],
  INCO: [{ commodityName: 'Nikel', relationship: 'Penambangan & peleburan nikel dalam matte' }],
  ANTM: [
    { commodityName: 'Emas', relationship: 'Penjualan & pemurnian emas' },
    { commodityName: 'Nikel', relationship: 'Penambangan bijih nikel & feronikel' },
    { commodityName: 'Bauksit', relationship: 'Penambangan bauksit & alumina' },
  ],
  NCKL: [{ commodityName: 'Nikel', relationship: 'Penambangan & pengolahan nikel (HPAL & RKEF)' }],
  MBMA: [{ commodityName: 'Nikel', relationship: 'Penambangan nikel & rantai pasok baterai EV' }],
  MDKA: [
    { commodityName: 'Emas', relationship: 'Penambangan emas (Tujuh Bukit & Pani)' },
    { commodityName: 'Tembaga', relationship: 'Penambangan tembaga (Wetar)' },
    { commodityName: 'Nikel', relationship: 'Pengolahan nikel via AIM/MBMA' },
  ],
  AMMN: [
    { commodityName: 'Tembaga', relationship: 'Penambangan tembaga (Batu Hijau)' },
    { commodityName: 'Emas', relationship: 'Produksi emas ikutan tembaga' },
  ],
  BRMS: [{ commodityName: 'Emas', relationship: 'Penambangan emas (Palu & Dairi)' }],
  TINS: [{ commodityName: 'Timah', relationship: 'Penambangan & peleburan timah BUMN' }],
  MEDC: [
    {
      commodityName: 'Minyak & Gas',
      relationship: 'Eksplorasi & produksi migas lepas pantai dan darat',
    },
  ],
  ENRG: [{ commodityName: 'Minyak & Gas', relationship: 'Eksplorasi & produksi migas' }],
  PGAS: [{ commodityName: 'Gas Alam', relationship: 'Distribusi & transmisi gas bumi' }],
  AALI: [
    { commodityName: 'CPO (Minyak Sawit)', relationship: 'Perkebunan & pengolahan kelapa sawit' },
  ],
  LSIP: [{ commodityName: 'CPO (Minyak Sawit)', relationship: 'Perkebunan kelapa sawit & karet' }],
  TAPG: [{ commodityName: 'CPO (Minyak Sawit)', relationship: 'Perkebunan & pabrik kelapa sawit' }],
  DSNG: [{ commodityName: 'CPO (Minyak Sawit)', relationship: 'Perkebunan sawit & produk kayu' }],
  INKP: [
    { commodityName: 'Pulp & Kertas', relationship: 'Produksi bubur kertas & kertas kemasan' },
  ],
  TKIM: [{ commodityName: 'Kertas', relationship: 'Produksi kertas budaya & industri' }],
}

export function analyzeBusinessExposure(
  symbol: string,
  companyName: string,
  rawSegments: RawSegmentItem[] = [],
): BusinessExposureAnalysis {
  const cleanTicker = normalizeTicker(symbol)

  // Normalize segments
  const segments: RevenueSegment[] = rawSegments.map((s) => ({
    name: s.name,
    value: s.value ?? null,
    percentage:
      s.percentage !== null && s.percentage !== undefined ? Number(s.percentage.toFixed(2)) : null,
  }))

  // Sort descending by percentage or value
  segments.sort((a, b) => (b.percentage ?? b.value ?? 0) - (a.percentage ?? a.value ?? 0))

  let largestSegment: BusinessExposureAnalysis['largestSegment'] = null
  let concentrationLevel: BusinessExposureAnalysis['concentrationLevel'] = 'UNKNOWN'

  if (segments.length > 0) {
    const top = segments[0]
    largestSegment = {
      name: top.name,
      percentage: top.percentage,
    }

    if (top.percentage !== null) {
      if (top.percentage >= 70) {
        concentrationLevel = 'HIGH'
      } else if (top.percentage >= 40) {
        concentrationLevel = 'MODERATE'
      } else {
        concentrationLevel = 'DIVERSIFIED'
      }
    }
  }

  // Check verified commodity exposures
  const knownExposures = VERIFIED_COMMODITY_MAP[cleanTicker]
  const commodityExposures: CommodityExposure[] = []

  if (knownExposures && knownExposures.length > 0) {
    for (const exp of knownExposures) {
      commodityExposures.push({
        commodityName: exp.commodityName,
        relationship: exp.relationship,
        verificationStatus: 'VERIFIED',
        sourceNote: 'Terverifikasi melalui segmen operasional dan laporan keuangan emiten.',
      })
    }
  } else {
    // Check if any segment clearly mentions commodity
    for (const seg of segments) {
      const lower = seg.name.toLowerCase()
      if (lower.includes('batubara') || lower.includes('coal')) {
        commodityExposures.push({
          commodityName: 'Batubara',
          relationship: `Segmen pendapatan: ${seg.name}`,
          verificationStatus: 'VERIFIED',
          sourceNote: 'Berdasarkan nama segmen pendapatan pada laporan perusahaan.',
        })
      } else if (lower.includes('nikel') || lower.includes('nickel')) {
        commodityExposures.push({
          commodityName: 'Nikel',
          relationship: `Segmen pendapatan: ${seg.name}`,
          verificationStatus: 'VERIFIED',
          sourceNote: 'Berdasarkan nama segmen pendapatan pada laporan perusahaan.',
        })
      } else if (lower.includes('sawit') || lower.includes('cpo') || lower.includes('palm')) {
        commodityExposures.push({
          commodityName: 'CPO (Minyak Sawit)',
          relationship: `Segmen pendapatan: ${seg.name}`,
          verificationStatus: 'VERIFIED',
          sourceNote: 'Berdasarkan nama segmen pendapatan pada laporan perusahaan.',
        })
      }
    }
  }

  // Summary generation
  let summary = ''
  if (largestSegment && largestSegment.percentage !== null) {
    summary += `Pendapatan didominasi oleh segmen ${largestSegment.name} (${largestSegment.percentage}%). `
    if (concentrationLevel === 'HIGH') {
      summary += 'Konsentrasi pendapatan tergolong tinggi pada satu lini bisnis. '
    } else if (concentrationLevel === 'MODERATE') {
      summary += 'Konsentrasi pendapatan tergolong moderat dengan lini bisnis pendukung. '
    } else {
      summary += 'Pendapatan terdiversifikasi di berbagai lini usaha. '
    }
  } else if (segments.length > 0) {
    summary += `Memiliki ${segments.length} segmen bisnis yang dilaporkan. `
  } else {
    summary += 'Rincian segmen pendapatan belum tersedia pada laporan keuangan. '
  }

  if (commodityExposures.length > 0) {
    const comNames = commodityExposures.map((c) => c.commodityName).join(', ')
    summary += `Memiliki eksposur langsung terhadap pergerakan komoditas: ${comNames}.`
  }

  return {
    symbol: cleanTicker,
    companyName,
    segments,
    largestSegment,
    concentrationLevel,
    commodityExposures,
    summary: summary.trim(),
  }
}
