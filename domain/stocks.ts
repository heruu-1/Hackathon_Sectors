export interface StockSuggestion {
  symbol: string
  name: string
  sector: string
}

export const POPULAR_STOCKS: StockSuggestion[] = [
  { symbol: 'BBCA', name: 'Bank Central Asia Tbk', sector: 'Financials' },
  { symbol: 'BBRI', name: 'Bank Rakyat Indonesia (Persero) Tbk', sector: 'Financials' },
  { symbol: 'BMRI', name: 'Bank Mandiri (Persero) Tbk', sector: 'Financials' },
  { symbol: 'BBNI', name: 'Bank Negara Indonesia (Persero) Tbk', sector: 'Financials' },
  { symbol: 'TLKM', name: 'Telkom Indonesia (Persero) Tbk', sector: 'Telecommunication' },
  { symbol: 'ASII', name: 'Astra International Tbk', sector: 'Industrials' },
  { symbol: 'ICBP', name: 'Indofood CBP Sukses Makmur Tbk', sector: 'Consumer Non-Cyclicals' },
  { symbol: 'INDF', name: 'Indofood Sukses Makmur Tbk', sector: 'Consumer Non-Cyclicals' },
  { symbol: 'UNVR', name: 'Unilever Indonesia Tbk', sector: 'Consumer Non-Cyclicals' },
  { symbol: 'KLBF', name: 'Kalbe Farma Tbk', sector: 'Healthcare' },
  { symbol: 'GOTO', name: 'GoTo Gojek Tokopedia Tbk', sector: 'Technology' },
  { symbol: 'AMMN', name: 'Amman Mineral Internasional Tbk', sector: 'Basic Materials' },
  { symbol: 'BREN', name: 'Barito Renewables Energy Tbk', sector: 'Energy' },
  { symbol: 'TPIA', name: 'Chandra Asri Pacific Tbk', sector: 'Basic Materials' },
  { symbol: 'BRIS', name: 'Bank Syariah Indonesia Tbk', sector: 'Financials' },
  { symbol: 'ADRO', name: 'Adaro Energy Indonesia Tbk', sector: 'Energy' },
  { symbol: 'PTBA', name: 'Bukit Asam Tbk', sector: 'Energy' },
  { symbol: 'ANTM', name: 'Aneka Tambang Tbk', sector: 'Basic Materials' },
  { symbol: 'INCO', name: 'Vale Indonesia Tbk', sector: 'Basic Materials' },
  { symbol: 'MDKA', name: 'Merdeka Copper Gold Tbk', sector: 'Basic Materials' },
  { symbol: 'PGAS', name: 'Perusahaan Gas Negara Tbk', sector: 'Energy' },
  { symbol: 'CPIN', name: 'Charoen Pokphand Indonesia Tbk', sector: 'Consumer Non-Cyclicals' },
  { symbol: 'JPFA', name: 'Japfa Comfeed Indonesia Tbk', sector: 'Consumer Non-Cyclicals' },
  { symbol: 'SMGR', name: 'Semen Indonesia (Persero) Tbk', sector: 'Basic Materials' },
  { symbol: 'INTP', name: 'Indocement Tunggal Prakarsa Tbk', sector: 'Basic Materials' },
  { symbol: 'ACES', name: 'Aspirasi Hidup Indonesia Tbk', sector: 'Consumer Cyclicals' },
  { symbol: 'MYOR', name: 'Mayora Indah Tbk', sector: 'Consumer Non-Cyclicals' },
  { symbol: 'UNTR', name: 'United Tractors Tbk', sector: 'Industrials' },
  { symbol: 'INKP', name: 'Indah Kiat Pulp & Paper Tbk', sector: 'Basic Materials' },
  { symbol: 'TKIM', name: 'Pabrik Kertas Tjiwi Kimia Tbk', sector: 'Basic Materials' },
  { symbol: 'MEDC', name: 'Medco Energi Internasional Tbk', sector: 'Energy' },
  { symbol: 'AKRA', name: 'AKR Corporindo Tbk', sector: 'Energy' },
  { symbol: 'EXCL', name: 'XL Axiata Tbk', sector: 'Telecommunication' },
  { symbol: 'ISAT', name: 'Indosat Tbk', sector: 'Telecommunication' },
  { symbol: 'BUKA', name: 'Bukalapak.com Tbk', sector: 'Technology' },
  { symbol: 'EMTK', name: 'Elang Mahkota Teknologi Tbk', sector: 'Technology' },
  { symbol: 'GGRM', name: 'Gudang Garam Tbk', sector: 'Consumer Non-Cyclicals' },
  { symbol: 'HMSP', name: 'Hanjaya Mandala Sampoerna Tbk', sector: 'Consumer Non-Cyclicals' },
  { symbol: 'BRPT', name: 'Barito Pacific Tbk', sector: 'Basic Materials' },
  { symbol: 'MAPI', name: 'Mitra Adiperkasa Tbk', sector: 'Consumer Cyclicals' },
  { symbol: 'MAPA', name: 'MAP Aktif Adiperkasa Tbk', sector: 'Consumer Cyclicals' },
  { symbol: 'ERAA', name: 'Erajaya Swasembada Tbk', sector: 'Consumer Cyclicals' },
  { symbol: 'MIKA', name: 'Mitra Keluarga Karyasehat Tbk', sector: 'Healthcare' },
  { symbol: 'HEAL', name: 'Medikaloka Hermina Tbk', sector: 'Healthcare' },
  { symbol: 'SILO', name: 'Siloam International Hospitals Tbk', sector: 'Healthcare' },
  { symbol: 'TBIG', name: 'Tower Bersama Infrastructure Tbk', sector: 'Telecommunication' },
  { symbol: 'TOWR', name: 'Sarana Menara Nusantara Tbk', sector: 'Telecommunication' },
  { symbol: 'PWON', name: 'Pakuwon Jati Tbk', sector: 'Properties & Real Estate' },
  { symbol: 'BSDE', name: 'Bumi Serpong Damai Tbk', sector: 'Properties & Real Estate' },
  { symbol: 'CTRA', name: 'Ciputra Development Tbk', sector: 'Properties & Real Estate' },
  { symbol: 'SMRA', name: 'Summarecon Agung Tbk', sector: 'Properties & Real Estate' },
]

const POPULAR_SET = new Set(POPULAR_STOCKS.map((s) => s.symbol))

/**
 * Calculates a relevance score for a stock suggestion given a user query.
 * Higher score means higher priority.
 */
export function getStockRelevanceScore(
  query: string,
  item: { symbol: string; name: string },
): number {
  const q = query.trim().toUpperCase()
  if (!q) return POPULAR_SET.has(item.symbol.toUpperCase()) ? 100 : 10

  const sym = item.symbol.toUpperCase().replace(/\.JK$/i, '')
  const name = item.name.toUpperCase()

  let score = 0

  if (sym === q) {
    score = 1000
  } else if (sym.startsWith(q)) {
    // Shorter ticker preferred when prefix matches (e.g. TLKM before TLKMAAAA)
    score = 500 + Math.max(0, 10 - sym.length)
  } else if (name.startsWith(q)) {
    score = 300
  } else if (sym.includes(q)) {
    score = 150
  } else if (name.includes(q)) {
    score = 50
  }

  // Bonus for popular / blue chip stocks (only if there is a match)
  if (score > 0 && POPULAR_SET.has(sym)) {
    score += 200
  }

  return score
}

/**
 * Fast synchronous search across popular Indonesian stocks.
 * Useful for instant (0ms) suggestions as the user types.
 */
export function searchLocalStocks(query: string, limit = 8): StockSuggestion[] {
  const q = query.trim().toUpperCase()
  if (!q) {
    return POPULAR_STOCKS.slice(0, limit)
  }

  const scored: Array<{ item: StockSuggestion; score: number }> = []

  for (const item of POPULAR_STOCKS) {
    const score = getStockRelevanceScore(q, item)
    if (score > 0) {
      scored.push({ item, score })
    }
  }

  scored.sort((a, b) => b.score - a.score || a.item.symbol.localeCompare(b.item.symbol))
  return scored.slice(0, limit).map((s) => s.item)
}
