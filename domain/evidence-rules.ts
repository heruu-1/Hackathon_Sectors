/**
 * Deterministic Evidence Rules Engine (rasi-mi-v2)
 *
 * Rules:
 * - R01: Price vs Foreign Flow divergence (5 sessions)
 * - R02: News Sentiment vs Foreign Flow divergence
 * - R03: News Sentiment vs Post-Event 1st-session return divergence
 * - R04: Volume Spike (RVol >= 2.0x)
 * - R05: Earnings Growth & Expanding Margin (handled in fundamentals)
 * - R06: Cheap Valuation with Deteriorating Earnings (handled in fundamentals/peers)
 * - R07: Positive Net Income with Negative Operating Cash Flow (handled in fundamentals)
 * - R08: Insider / Major Shareholder Filing
 * - R09: Upcoming Corporate Action (within 30 calendar days)
 * - R10: Price Window Traversed by Corporate Action (suspends direct comparison)
 */

export type RuleEvaluationStatus = 'EVALUATED_TRUE' | 'EVALUATED_FALSE' | 'NOT_EVALUABLE'

export interface RuleEvaluationResult {
  ruleId: string
  ruleVersion: string
  status: RuleEvaluationStatus
  title: string
  description: string
  evidenceDirection?: 'ALIGNED' | 'CONFLICTING' | 'NEUTRAL'
  supportingEvidence?: string[]
  conflictingEvidence?: string[]
  missingData?: string[]
}

export interface RuleEngineInput {
  // R01 input
  priceReturn5Sessions?: number | null
  netForeignFlow5Sessions?: number | null

  // R02 input
  newsDirection?: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null
  foreignFlowDirection?: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL' | null

  // R03 input
  postNews1SessionReturn?: number | null

  // R04 input
  relativeVolume20?: number | null

  // R05 input: Consistent fundamental growth vs lagging price
  revenueGrowthYoY?: number | null
  netIncomeGrowthYoY?: number | null
  relativeReturn20VsIhsg?: number | null

  // R06 input: Cheap valuation with deteriorating earnings
  peStatus?:
    | 'DISCOUNT'
    | 'PREMIUM'
    | 'IN_LINE'
    | 'NEGATIVE_EARNINGS'
    | 'NEGATIVE_EQUITY'
    | 'UNAVAILABLE'
    | null
  pbStatus?:
    | 'DISCOUNT'
    | 'PREMIUM'
    | 'IN_LINE'
    | 'NEGATIVE_EARNINGS'
    | 'NEGATIVE_EQUITY'
    | 'UNAVAILABLE'
    | null

  // R07 input: Positive net income with negative operating cash flow
  netIncome?: number | null
  operatingCashFlow?: number | null
  isFinancialSector?: boolean | null

  // R08 input
  filingsCount?: number | null
  hasClassifiableFiling?: boolean | null

  // R09 input
  upcomingCorporateActionsDays?: number | null

  // R10 input
  hasCorporateActionInPriceWindow?: boolean | null
}

export const CURRENT_RULE_VERSION = 'rasi-mi-v2'

export function evaluateR01(input: RuleEngineInput): RuleEvaluationResult {
  const { priceReturn5Sessions, netForeignFlow5Sessions } = input

  if (
    priceReturn5Sessions === null ||
    priceReturn5Sessions === undefined ||
    netForeignFlow5Sessions === null ||
    netForeignFlow5Sessions === undefined
  ) {
    return {
      ruleId: 'R01',
      ruleVersion: CURRENT_RULE_VERSION,
      status: 'NOT_EVALUABLE',
      title: 'Perbedaan harga dan arus asing',
      description: 'Data harga 5 sesi atau arus asing tidak mencukupi untuk evaluasi.',
      missingData: ['Data harga 5 sesi', 'Data arus asing 5 sesi'],
    }
  }

  const priceUp = priceReturn5Sessions > 0
  const priceDown = priceReturn5Sessions < 0
  const foreignBuy = netForeignFlow5Sessions > 0
  const foreignSell = netForeignFlow5Sessions < 0

  const isDivergent = (priceUp && foreignSell) || (priceDown && foreignBuy)

  if (isDivergent) {
    return {
      ruleId: 'R01',
      ruleVersion: CURRENT_RULE_VERSION,
      status: 'EVALUATED_TRUE',
      title: 'Perbedaan harga dan arus asing',
      description: `Arah harga 5 sesi (${(priceReturn5Sessions * 100).toFixed(2)}%) berlawanan dengan arus asing (Net ${netForeignFlow5Sessions > 0 ? 'Buy' : 'Sell'}).`,
      evidenceDirection: 'CONFLICTING',
      supportingEvidence: [
        `Return 5 sesi: ${(priceReturn5Sessions * 100).toFixed(2)}%`,
        `Net Asing 5 sesi: ${netForeignFlow5Sessions > 0 ? '+' : ''}${netForeignFlow5Sessions.toLocaleString('id-ID')}`,
      ],
    }
  }

  return {
    ruleId: 'R01',
    ruleVersion: CURRENT_RULE_VERSION,
    status: 'EVALUATED_FALSE',
    title: 'Perbedaan harga dan arus asing',
    description: 'Arah harga dan arus asing selaras atau netral.',
    evidenceDirection: 'ALIGNED',
  }
}

export function evaluateR02(input: RuleEngineInput): RuleEvaluationResult {
  const { newsDirection, foreignFlowDirection } = input

  if (
    !newsDirection ||
    !foreignFlowDirection ||
    newsDirection === 'NEUTRAL' ||
    foreignFlowDirection === 'NEUTRAL'
  ) {
    return {
      ruleId: 'R02',
      ruleVersion: CURRENT_RULE_VERSION,
      status: 'NOT_EVALUABLE',
      title: 'Perbedaan berita dan arus asing',
      description: 'Sentimen berita atau arah arus asing belum dapat ditentukan.',
      missingData: ['Sentimen berita terarah', 'Arah arus asing non-netral'],
    }
  }

  const isDivergent =
    (newsDirection === 'BULLISH' && foreignFlowDirection === 'DISTRIBUTION') ||
    (newsDirection === 'BEARISH' && foreignFlowDirection === 'ACCUMULATION')

  if (isDivergent) {
    return {
      ruleId: 'R02',
      ruleVersion: CURRENT_RULE_VERSION,
      status: 'EVALUATED_TRUE',
      title: 'Perbedaan berita dan arus asing',
      description: `Sentimen berita (${newsDirection}) berlawanan dengan arah arus asing (${foreignFlowDirection}).`,
      evidenceDirection: 'CONFLICTING',
      supportingEvidence: [
        `Sentimen berita: ${newsDirection}`,
        `Arah arus asing: ${foreignFlowDirection}`,
      ],
    }
  }

  return {
    ruleId: 'R02',
    ruleVersion: CURRENT_RULE_VERSION,
    status: 'EVALUATED_FALSE',
    title: 'Perbedaan berita dan arus asing',
    description: 'Sentimen berita dan arus asing searah.',
    evidenceDirection: 'ALIGNED',
  }
}

export function evaluateR03(input: RuleEngineInput): RuleEvaluationResult {
  const { newsDirection, postNews1SessionReturn } = input

  if (
    !newsDirection ||
    newsDirection === 'NEUTRAL' ||
    postNews1SessionReturn === null ||
    postNews1SessionReturn === undefined
  ) {
    return {
      ruleId: 'R03',
      ruleVersion: CURRENT_RULE_VERSION,
      status: 'NOT_EVALUABLE',
      title: 'Perbedaan berita dan respon harga',
      description: 'Sentimen berita atau respon harga sesi ke-1 tidak tersedia.',
      missingData: ['Respon harga sesi ke-1 setelah berita'],
    }
  }

  const priceUp = postNews1SessionReturn > 0
  const priceDown = postNews1SessionReturn < 0

  const isDivergent =
    (newsDirection === 'BULLISH' && priceDown) || (newsDirection === 'BEARISH' && priceUp)

  if (isDivergent) {
    return {
      ruleId: 'R03',
      ruleVersion: CURRENT_RULE_VERSION,
      status: 'EVALUATED_TRUE',
      title: 'Perbedaan berita dan respon harga',
      description: `Sentimen berita (${newsDirection}) berlawanan dengan return sesi ke-1 (${(postNews1SessionReturn * 100).toFixed(2)}%).`,
      evidenceDirection: 'CONFLICTING',
      supportingEvidence: [
        `Sentimen berita: ${newsDirection}`,
        `Return sesi ke-1: ${(postNews1SessionReturn * 100).toFixed(2)}%`,
      ],
    }
  }

  return {
    ruleId: 'R03',
    ruleVersion: CURRENT_RULE_VERSION,
    status: 'EVALUATED_FALSE',
    title: 'Perbedaan berita dan respon harga',
    description: 'Respon harga sesi ke-1 selaras dengan sentimen berita.',
    evidenceDirection: 'ALIGNED',
  }
}

export function evaluateR04(input: RuleEngineInput): RuleEvaluationResult {
  const { relativeVolume20 } = input

  if (relativeVolume20 === null || relativeVolume20 === undefined) {
    return {
      ruleId: 'R04',
      ruleVersion: CURRENT_RULE_VERSION,
      status: 'NOT_EVALUABLE',
      title: 'Aktivitas volume meningkat',
      description: 'Data volume 20 sesi tidak mencukupi untuk menghitung relative volume.',
      missingData: ['Minimal 21 observasi volume harian'],
    }
  }

  if (relativeVolume20 >= 2.0) {
    return {
      ruleId: 'R04',
      ruleVersion: CURRENT_RULE_VERSION,
      status: 'EVALUATED_TRUE',
      title: 'Aktivitas volume meningkat',
      description: `Volume perdagangan meningkat ${relativeVolume20}x dibanding rata-rata 20 sesi sebelumnya.`,
      supportingEvidence: [`Relative Volume: ${relativeVolume20}x (ambang >= 2.0x)`],
    }
  }

  return {
    ruleId: 'R04',
    ruleVersion: CURRENT_RULE_VERSION,
    status: 'EVALUATED_FALSE',
    title: 'Aktivitas volume meningkat',
    description: `Volume normal (${relativeVolume20}x, ambang batas 2.0x belum terlampaui).`,
  }
}

export function evaluateR05(input: RuleEngineInput): RuleEvaluationResult {
  const { revenueGrowthYoY, netIncomeGrowthYoY, relativeReturn20VsIhsg } = input

  if (
    revenueGrowthYoY === null ||
    revenueGrowthYoY === undefined ||
    netIncomeGrowthYoY === null ||
    netIncomeGrowthYoY === undefined ||
    relativeReturn20VsIhsg === null ||
    relativeReturn20VsIhsg === undefined
  ) {
    return {
      ruleId: 'R05',
      ruleVersion: CURRENT_RULE_VERSION,
      status: 'NOT_EVALUABLE',
      title: 'Pertumbuhan fundamental konsisten vs harga tertinggal',
      description: 'Data pertumbuhan kuartalan atau return 20 sesi vs IHSG tidak lengkap.',
      missingData: ['Pertumbuhan pendapatan/laba YoY', 'Return 20 sesi vs IHSG'],
    }
  }

  const isGrowthStrong = revenueGrowthYoY >= 0.15 && netIncomeGrowthYoY >= 0.15
  const isPriceLagging = relativeReturn20VsIhsg < 0

  if (isGrowthStrong && isPriceLagging) {
    return {
      ruleId: 'R05',
      ruleVersion: CURRENT_RULE_VERSION,
      status: 'EVALUATED_TRUE',
      title: 'Pertumbuhan fundamental konsisten vs harga tertinggal',
      description: `Pendapatan (+${(revenueGrowthYoY * 100).toFixed(1)}%) dan laba (+${(netIncomeGrowthYoY * 100).toFixed(1)}%) tumbuh di atas 15%, namun pergerakan harga 20 sesi tertinggal dari IHSG (${(relativeReturn20VsIhsg * 100).toFixed(1)}%).`,
      evidenceDirection: 'CONFLICTING',
      supportingEvidence: [
        `Pertumbuhan pendapatan YoY: +${(revenueGrowthYoY * 100).toFixed(1)}%`,
        `Pertumbuhan laba bersih YoY: +${(netIncomeGrowthYoY * 100).toFixed(1)}%`,
        `Relative Return 20 sesi vs IHSG: ${(relativeReturn20VsIhsg * 100).toFixed(1)}%`,
      ],
    }
  }

  return {
    ruleId: 'R05',
    ruleVersion: CURRENT_RULE_VERSION,
    status: 'EVALUATED_FALSE',
    title: 'Pertumbuhan fundamental konsisten vs harga tertinggal',
    description: 'Kondisi pertumbuhan fundamental kuat dengan harga tertinggal tidak terpenuhi.',
    evidenceDirection: 'ALIGNED',
  }
}

export function evaluateR06(input: RuleEngineInput): RuleEvaluationResult {
  const { peStatus, pbStatus, netIncomeGrowthYoY, revenueGrowthYoY } = input

  if (!peStatus && !pbStatus) {
    return {
      ruleId: 'R06',
      ruleVersion: CURRENT_RULE_VERSION,
      status: 'NOT_EVALUABLE',
      title: 'Valuasi murah dengan kinerja laba melemah',
      description: 'Status valuasi relatif terhadap peers industri belum tersedia.',
      missingData: ['Data valuasi peers industri'],
    }
  }

  const isDiscount = peStatus === 'DISCOUNT' || pbStatus === 'DISCOUNT'
  const isDeteriorating =
    (typeof netIncomeGrowthYoY === 'number' && netIncomeGrowthYoY < 0) ||
    (typeof revenueGrowthYoY === 'number' && revenueGrowthYoY < 0)

  if (isDiscount && isDeteriorating) {
    return {
      ruleId: 'R06',
      ruleVersion: CURRENT_RULE_VERSION,
      status: 'EVALUATED_TRUE',
      title: 'Valuasi murah dengan kinerja laba melemah',
      description:
        'Valuasi di bawah median industri (diskon), namun pertumbuhan laba atau pendapatan mengalami penurunan/negatif.',
      evidenceDirection: 'CONFLICTING',
      supportingEvidence: [
        `Status P/E: ${peStatus ?? 'N/A'}, Status P/B: ${pbStatus ?? 'N/A'}`,
        `Pertumbuhan Laba YoY: ${netIncomeGrowthYoY !== null && netIncomeGrowthYoY !== undefined ? (netIncomeGrowthYoY * 100).toFixed(1) + '%' : 'N/A'}`,
      ],
    }
  }

  return {
    ruleId: 'R06',
    ruleVersion: CURRENT_RULE_VERSION,
    status: 'EVALUATED_FALSE',
    title: 'Valuasi murah dengan kinerja laba melemah',
    description: 'Valuasi dan tren pertumbuhan tidak menunjukkan perangkap nilai (value trap).',
    evidenceDirection: 'ALIGNED',
  }
}

export function evaluateR07(input: RuleEngineInput): RuleEvaluationResult {
  const { netIncome, operatingCashFlow, isFinancialSector } = input

  if (isFinancialSector) {
    return {
      ruleId: 'R07',
      ruleVersion: CURRENT_RULE_VERSION,
      status: 'EVALUATED_FALSE',
      title: 'Divergensi laba dan arus kas operasi',
      description:
        'Arus kas operasi tidak dijadikan tolok ukur divergensi kualitas laba untuk sektor keuangan/perbankan.',
      evidenceDirection: 'NEUTRAL',
    }
  }

  if (
    netIncome === null ||
    netIncome === undefined ||
    operatingCashFlow === null ||
    operatingCashFlow === undefined
  ) {
    return {
      ruleId: 'R07',
      ruleVersion: CURRENT_RULE_VERSION,
      status: 'NOT_EVALUABLE',
      title: 'Divergensi laba dan arus kas operasi',
      description: 'Data laba bersih atau arus kas operasi tidak lengkap.',
      missingData: ['Laba bersih kuartalan', 'Arus kas operasi kuartalan'],
    }
  }

  const isDivergent = netIncome > 0 && operatingCashFlow < 0

  if (isDivergent) {
    return {
      ruleId: 'R07',
      ruleVersion: CURRENT_RULE_VERSION,
      status: 'EVALUATED_TRUE',
      title: 'Divergensi laba dan arus kas operasi',
      description: `Perusahaan membukukan laba bersih positif (Rp ${netIncome.toLocaleString('id-ID')}) namun arus kas operasi negatif (Rp ${operatingCashFlow.toLocaleString('id-ID')}).`,
      evidenceDirection: 'CONFLICTING',
      supportingEvidence: [
        `Laba Bersih: Rp ${netIncome.toLocaleString('id-ID')}`,
        `Arus Kas Operasi: Rp ${operatingCashFlow.toLocaleString('id-ID')}`,
      ],
    }
  }

  return {
    ruleId: 'R07',
    ruleVersion: CURRENT_RULE_VERSION,
    status: 'EVALUATED_FALSE',
    title: 'Divergensi laba dan arus kas operasi',
    description: 'Arus kas operasi sejalan dengan pencapaian laba bersih.',
    evidenceDirection: 'ALIGNED',
  }
}

export function evaluateR08(input: RuleEngineInput): RuleEvaluationResult {
  const { filingsCount, hasClassifiableFiling } = input

  if (filingsCount === null || filingsCount === undefined) {
    return {
      ruleId: 'R08',
      ruleVersion: CURRENT_RULE_VERSION,
      status: 'NOT_EVALUABLE',
      title: 'Perubahan transaksi pemegang saham',
      description: 'Data pelaporan keterbukaan informasi (filings) tidak tersedia.',
      missingData: ['Data keterbukaan informasi'],
    }
  }

  if (hasClassifiableFiling) {
    return {
      ruleId: 'R08',
      ruleVersion: CURRENT_RULE_VERSION,
      status: 'EVALUATED_TRUE',
      title: 'Perubahan transaksi pemegang saham untuk diperiksa',
      description: 'Ditemukan publikasi filing transaksi pemegang saham besar atau manajemen.',
      supportingEvidence: ['Publikasi filing transaksi insider terdeteksi'],
    }
  }

  return {
    ruleId: 'R08',
    ruleVersion: CURRENT_RULE_VERSION,
    status: 'EVALUATED_FALSE',
    title: 'Perubahan transaksi pemegang saham',
    description: 'Tidak ada pelaporan transaksi pemegang saham yang dapat diklasifikasikan.',
  }
}

export function evaluateR09(input: RuleEngineInput): RuleEvaluationResult {
  const { upcomingCorporateActionsDays } = input

  if (upcomingCorporateActionsDays === null || upcomingCorporateActionsDays === undefined) {
    return {
      ruleId: 'R09',
      ruleVersion: CURRENT_RULE_VERSION,
      status: 'NOT_EVALUABLE',
      title: 'Peristiwa mendatang',
      description: 'Kalender aksi korporasi belum dapat diperiksa.',
      missingData: ['Data kalender aksi korporasi'],
    }
  }

  if (upcomingCorporateActionsDays >= 0 && upcomingCorporateActionsDays <= 30) {
    return {
      ruleId: 'R09',
      ruleVersion: CURRENT_RULE_VERSION,
      status: 'EVALUATED_TRUE',
      title: 'Peristiwa mendatang',
      description: `Aksi korporasi mendatang dijadwalkan dalam ${upcomingCorporateActionsDays} hari kalender.`,
      supportingEvidence: [
        `Aksi korporasi dalam ${upcomingCorporateActionsDays} hari (ambang <= 30 hari)`,
      ],
    }
  }

  return {
    ruleId: 'R09',
    ruleVersion: CURRENT_RULE_VERSION,
    status: 'EVALUATED_FALSE',
    title: 'Peristiwa mendatang',
    description: 'Tidak ada aksi korporasi dalam 30 hari kalender mendatang.',
  }
}

export function evaluateR10(input: RuleEngineInput): RuleEvaluationResult {
  const { hasCorporateActionInPriceWindow } = input

  if (hasCorporateActionInPriceWindow === null || hasCorporateActionInPriceWindow === undefined) {
    return {
      ruleId: 'R10',
      ruleVersion: CURRENT_RULE_VERSION,
      status: 'NOT_EVALUABLE',
      title: 'Perbandingan harga perlu ditangguhkan',
      description: 'Riwayat aksi korporasi pada jendela harga tidak tersedia.',
      missingData: ['Riwayat aksi korporasi pada jendela harga'],
    }
  }

  if (hasCorporateActionInPriceWindow) {
    return {
      ruleId: 'R10',
      ruleVersion: CURRENT_RULE_VERSION,
      status: 'EVALUATED_TRUE',
      title: 'Perbandingan harga perlu ditangguhkan',
      description:
        'Jendela harga melewati aksi korporasi (split/reverse/rights) yang memengaruhi kesinambungan harga historis.',
      supportingEvidence: ['Aksi korporasi terdeteksi dalam jendela perhitungan harga'],
    }
  }

  return {
    ruleId: 'R10',
    ruleVersion: CURRENT_RULE_VERSION,
    status: 'EVALUATED_FALSE',
    title: 'Perbandingan harga perlu ditangguhkan',
    description: 'Tidak ada aksi korporasi yang mengganggu kesinambungan harga historis.',
  }
}

export function evaluateAllEvidenceRules(input: RuleEngineInput): RuleEvaluationResult[] {
  return [
    evaluateR01(input),
    evaluateR02(input),
    evaluateR03(input),
    evaluateR04(input),
    evaluateR05(input),
    evaluateR06(input),
    evaluateR07(input),
    evaluateR08(input),
    evaluateR09(input),
    evaluateR10(input),
  ]
}
