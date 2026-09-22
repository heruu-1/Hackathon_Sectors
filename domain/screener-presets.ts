/**
 * Domain module for research screener presets (F10) and safe CSV export with formula injection protection.
 */

export interface ScreenerPreset {
  id: string
  title: string
  description: string
  filters: {
    sector?: string
    minMarketCap?: string // in Trillion IDR
    maxPe?: string
    maxPb?: string
    minYield?: string
    minEarningsGrowth?: string
    ruleId?: 'R01' | 'R04' | 'R05' | 'R06' | 'R07'
    flowCondition?: 'FOREIGN_ACCUMULATION_5D'
  }
}

export const MANDATORY_SCREENER_PRESETS: ScreenerPreset[] = [
  {
    id: 'foreign_flow_5d',
    title: 'Arus Asing Konsisten',
    description: 'Saham dengan akumulasi bersih investor asing selama 5 sesi bursa berturut-turut.',
    filters: {
      flowCondition: 'FOREIGN_ACCUMULATION_5D',
      minMarketCap: '1', // Min 1 Triliun untuk likuiditas
    },
  },
  {
    id: 'undervalued_peers',
    title: 'Valuasi Murah vs Peers',
    description: 'P/E dan P/B di bawah median industri sejenis dengan profitabilitas terjaga.',
    filters: {
      maxPe: '15',
      maxPb: '2',
      minEarningsGrowth: '0',
    },
  },
  {
    id: 'volume_spike',
    title: 'Lonjakan Volume Perdagangan',
    description: 'Relative volume (RVol) minimal 2.0x dibanding rata-rata 20 sesi sebelumnya.',
    filters: {
      ruleId: 'R04',
      minMarketCap: '0.5',
    },
  },
  {
    id: 'strong_growth',
    title: 'Pertumbuhan Laba Kuat',
    description: 'Pertumbuhan laba bersih kuartalan YoY di atas 20% dengan neraca sehat.',
    filters: {
      minEarningsGrowth: '0.20',
      minMarketCap: '1',
    },
  },
  {
    id: 'high_dividend',
    title: 'Dividen Yield Tinggi',
    description:
      'Imbal hasil dividen (dividend yield) minimal 5% dari perusahaan yang konsisten mencetak laba.',
    filters: {
      minYield: '0.05',
      minEarningsGrowth: '0',
    },
  },
  {
    id: 'value_trap_risk',
    title: 'Risiko Perangkap Nilai (Value Trap)',
    description:
      'Valuasi P/E tampak murah, namun laba bersih mengalami tren kontraksi/melemah (Rule R06).',
    filters: {
      ruleId: 'R06',
      maxPe: '10',
    },
  },
  {
    id: 'cash_flow_divergence',
    title: 'Divergensi Laba vs Kas Operasi',
    description:
      'Perusahaan membukukan laba bersih positif tetapi arus kas operasi negatif (Rule R07).',
    filters: {
      ruleId: 'R07',
    },
  },
]

/**
 * Sanitizes a cell value for CSV export to prevent CSV / Formula Injection vulnerabilities.
 * If the value starts with '=', '+', '-', '@', or contains tabs/newlines,
 * it is safely escaped with a leading single quote (') and wrapped in quotes.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""'
  }

  const str = String(value).trim()

  // Formula injection dangerous characters at the start of a cell
  const DANGEROUS_PREFIXES = ['=', '+', '-', '@', '\t', '\r']
  let safeStr = str

  if (DANGEROUS_PREFIXES.some((prefix) => str.startsWith(prefix))) {
    // Prepend single quote to neutralize formula execution in Excel / Google Sheets
    safeStr = `'${str}`
  }

  // Escape existing double quotes by doubling them
  safeStr = safeStr.replace(/"/g, '""')

  return `"${safeStr}"`
}

/**
 * Generates safe CSV content from tabular data.
 */
export function generateSafeCsv<T extends Record<string, unknown>>(
  columns: Array<{ key: keyof T; header: string }>,
  rows: T[],
): string {
  const headerLine = columns.map((c) => sanitizeCsvCell(c.header)).join(',')
  const dataLines = rows.map((row) => columns.map((col) => sanitizeCsvCell(row[col.key])).join(','))

  return [headerLine, ...dataLines].join('\r\n')
}
