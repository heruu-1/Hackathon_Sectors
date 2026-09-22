import { z } from 'zod'

export type AccessStatus = 'UNVERIFIED' | 'AVAILABLE' | 'FORBIDDEN' | 'UNAVAILABLE'

export interface CostRule {
  type: 'FIXED' | 'PER_QUARTER' | 'PER_SECTION' | 'VARIABLE'
  baseCredits: number
  calculateCost: (params?: Record<string, unknown>) => number
}

export interface ApiCapability {
  capabilityId: string
  documentationUrl: string
  verifiedApiPath: string
  costRule: CostRule
  accessStatus: AccessStatus
  lastVerifiedAt: string | null
  fallbackCapability?: string
}

export const CAPABILITIES: Record<string, ApiCapability> = {
  companies_screener: {
    capabilityId: 'companies_screener',
    documentationUrl: 'https://docs.sectors.app/api-references/v2/indonesia/screener/companies',
    verifiedApiPath: 'https://api.sectors.app/v2/companies/',
    costRule: {
      type: 'FIXED',
      baseCredits: 1,
      calculateCost: () => 1,
    },
    accessStatus: 'AVAILABLE',
    lastVerifiedAt: '2026-09-22T00:00:00Z',
  },
  daily_price: {
    capabilityId: 'daily_price',
    documentationUrl:
      'https://docs.sectors.app/api-references/v2/indonesia/transaction/daily-by-symbol',
    verifiedApiPath: 'https://api.sectors.app/v2/daily/{symbol}/',
    costRule: {
      type: 'FIXED',
      baseCredits: 1,
      calculateCost: () => 1,
    },
    accessStatus: 'AVAILABLE',
    lastVerifiedAt: '2026-09-22T00:00:00Z',
  },
  daily_full_universe: {
    capabilityId: 'daily_full_universe',
    documentationUrl: 'https://docs.sectors.app/llms.txt',
    verifiedApiPath: 'https://api.sectors.app/v2/daily/',
    costRule: {
      type: 'FIXED',
      baseCredits: 1,
      calculateCost: () => 1,
    },
    accessStatus: 'UNVERIFIED',
    lastVerifiedAt: null,
    fallbackCapability: 'companies_screener',
  },
  broker_summary: {
    capabilityId: 'broker_summary',
    documentationUrl:
      'https://docs.sectors.app/api-references/v2/indonesia/brokers/broker-summary-by-symbol',
    verifiedApiPath: 'https://api.sectors.app/v2/broker-summary/{symbol}/',
    costRule: {
      type: 'FIXED',
      baseCredits: 1,
      calculateCost: () => 1,
    },
    accessStatus: 'AVAILABLE',
    lastVerifiedAt: '2026-09-22T00:00:00Z',
  },
  broker_activity: {
    capabilityId: 'broker_activity',
    documentationUrl:
      'https://docs.sectors.app/api-references/v2/indonesia/brokers/broker-activity-by-code',
    verifiedApiPath: 'https://api.sectors.app/v2/broker-activity/{broker_code}/',
    costRule: {
      type: 'FIXED',
      baseCredits: 1,
      calculateCost: () => 1,
    },
    accessStatus: 'AVAILABLE',
    lastVerifiedAt: '2026-09-22T00:00:00Z',
  },
  brokers_registry: {
    capabilityId: 'brokers_registry',
    documentationUrl: 'https://docs.sectors.app/api-references/v2/indonesia/brokers/brokers',
    verifiedApiPath: 'https://api.sectors.app/v2/brokers/',
    costRule: {
      type: 'FIXED',
      baseCredits: 1,
      calculateCost: () => 1,
    },
    accessStatus: 'AVAILABLE',
    lastVerifiedAt: '2026-09-22T00:00:00Z',
  },
  foreign_flow: {
    capabilityId: 'foreign_flow',
    documentationUrl:
      'https://docs.sectors.app/api-references/v2/indonesia/brokers/foreign-flow-by-symbol',
    verifiedApiPath: 'https://api.sectors.app/v2/foreign-flow/{symbol}/',
    costRule: {
      type: 'FIXED',
      baseCredits: 1,
      calculateCost: () => 1,
    },
    accessStatus: 'AVAILABLE',
    lastVerifiedAt: '2026-09-22T00:00:00Z',
  },
  market_news: {
    capabilityId: 'market_news',
    documentationUrl: 'https://docs.sectors.app/api-references/v2/indonesia/news/news',
    verifiedApiPath: 'https://api.sectors.app/v2/news/',
    costRule: {
      type: 'FIXED',
      baseCredits: 1,
      calculateCost: () => 1,
    },
    accessStatus: 'AVAILABLE',
    lastVerifiedAt: '2026-09-22T00:00:00Z',
  },
  filings: {
    capabilityId: 'filings',
    documentationUrl: 'https://docs.sectors.app/api-references/v2/indonesia/company/filings',
    verifiedApiPath: 'https://api.sectors.app/v2/filings/',
    costRule: {
      type: 'FIXED',
      baseCredits: 1,
      calculateCost: () => 1,
    },
    accessStatus: 'AVAILABLE',
    lastVerifiedAt: '2026-09-22T00:00:00Z',
  },
  corporate_actions: {
    capabilityId: 'corporate_actions',
    documentationUrl:
      'https://docs.sectors.app/api-references/v2/indonesia/company/corporate-actions',
    verifiedApiPath: 'https://api.sectors.app/v2/company/{symbol}/corporate-actions/',
    costRule: {
      type: 'FIXED',
      baseCredits: 1,
      calculateCost: () => 1,
    },
    accessStatus: 'AVAILABLE',
    lastVerifiedAt: '2026-09-22T00:00:00Z',
  },
  financials_quarterly: {
    capabilityId: 'financials_quarterly',
    documentationUrl:
      'https://docs.sectors.app/api-references/v2/indonesia/report/quarterly-financials',
    verifiedApiPath: 'https://api.sectors.app/v2/financials/quarterly/{symbol}/',
    costRule: {
      type: 'PER_QUARTER',
      baseCredits: 1,
      calculateCost: (params) => {
        const quarters = Number(params?.quarters ?? 5)
        return Math.max(1, Math.min(quarters, 20))
      },
    },
    accessStatus: 'AVAILABLE',
    lastVerifiedAt: '2026-09-22T00:00:00Z',
  },
  company_report: {
    capabilityId: 'company_report',
    documentationUrl: 'https://docs.sectors.app/api-references/v2/indonesia/report/company-report',
    verifiedApiPath: 'https://api.sectors.app/v2/company/report/{symbol}/',
    costRule: {
      type: 'PER_SECTION',
      baseCredits: 1,
      calculateCost: (params) => {
        const sections = Array.isArray(params?.sections)
          ? params.sections
          : typeof params?.sections === 'string'
            ? params.sections.split(',').filter(Boolean)
            : ['valuation']
        return Math.max(1, sections.length)
      },
    },
    accessStatus: 'AVAILABLE',
    lastVerifiedAt: '2026-09-22T00:00:00Z',
  },
  index_daily: {
    capabilityId: 'index_daily',
    documentationUrl:
      'https://docs.sectors.app/api-references/v2/indonesia/transaction/index-daily',
    verifiedApiPath: 'https://api.sectors.app/v2/index-daily/{index_code}/',
    costRule: {
      type: 'FIXED',
      baseCredits: 1,
      calculateCost: () => 1,
    },
    accessStatus: 'AVAILABLE',
    lastVerifiedAt: '2026-09-22T00:00:00Z',
  },
  free_float: {
    capabilityId: 'free_float',
    documentationUrl: 'https://docs.sectors.app/api-references/v2/indonesia/screener/free-float',
    verifiedApiPath: 'https://api.sectors.app/v2/screener/free-float/',
    costRule: {
      type: 'VARIABLE',
      baseCredits: 1,
      calculateCost: () => 1,
    },
    accessStatus: 'UNVERIFIED',
    lastVerifiedAt: null,
  },
  mining_data: {
    capabilityId: 'mining_data',
    documentationUrl: 'https://docs.sectors.app/llms.txt',
    verifiedApiPath: 'https://api.sectors.app/v2/mining/',
    costRule: {
      type: 'FIXED',
      baseCredits: 1,
      calculateCost: () => 1,
    },
    accessStatus: 'UNVERIFIED',
    lastVerifiedAt: null,
    fallbackCapability: 'company_report',
  },
  suspension_history: {
    capabilityId: 'suspension_history',
    documentationUrl: 'https://docs.sectors.app/llms.txt',
    verifiedApiPath: 'https://api.sectors.app/v2/suspensions/',
    costRule: {
      type: 'FIXED',
      baseCredits: 1,
      calculateCost: () => 1,
    },
    accessStatus: 'UNVERIFIED',
    lastVerifiedAt: null,
  },
}

export function getCapability(id: string): ApiCapability | undefined {
  return CAPABILITIES[id]
}

export function calculateCapabilityCost(id: string, params?: Record<string, unknown>): number {
  const cap = CAPABILITIES[id]
  if (!cap) return 1
  return cap.costRule.calculateCost(params)
}

// Zod schemas for response validation
export const DailyPriceRowSchema = z.object({
  symbol: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  close: z.number(),
  open: z.number().nullable().optional(),
  high: z.number().nullable().optional(),
  low: z.number().nullable().optional(),
  volume: z.number(),
  marketCap: z.number().nullable().optional(),
})

export const BrokerSummaryItemSchema = z.object({
  broker_code: z.string(),
  buy_volume: z.number().optional().default(0),
  buy_value: z.number().optional().default(0),
  sell_volume: z.number().optional().default(0),
  sell_value: z.number().optional().default(0),
  net_volume: z.number().optional().default(0),
  net_value: z.number().optional().default(0),
  is_foreign: z.boolean().optional().default(false),
})

export const QuarterlyFinancialItemSchema = z.object({
  symbol: z.string().optional(),
  quarter: z.string(), // e.g. "2024-Q3"
  revenue: z.number().nullable().optional(),
  net_income: z.number().nullable().optional(),
  operating_profit: z.number().nullable().optional(),
  operating_cash_flow: z.number().nullable().optional(),
  total_assets: z.number().nullable().optional(),
  total_liabilities: z.number().nullable().optional(),
  total_equity: z.number().nullable().optional(),
})

export const CompanyReportValuationSchema = z.object({
  company_name: z.string().optional(),
  symbol: z.string().optional(),
  valuation: z
    .object({
      last_close_price: z.number().nullable().optional(),
      latest_close_date: z.string().nullable().optional(),
      daily_close_change: z.number().nullable().optional(),
      historical_valuation: z
        .array(
          z.object({
            year: z.number().or(z.string()),
            pe: z.number().nullable().optional(),
            pb: z.number().nullable().optional(),
          }),
        )
        .optional()
        .default([]),
    })
    .optional()
    .default({ historical_valuation: [] }),
})
