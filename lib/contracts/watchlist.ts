import { z } from 'zod'

export const WATCHLIST_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const
export type WatchlistPriority = (typeof WATCHLIST_PRIORITIES)[number]

export const WATCHLIST_STATUSES = ['WATCHING', 'ACCUMULATING', 'SLEEPING_GIANT', 'BOUGHT'] as const
export type WatchlistStatus = (typeof WATCHLIST_STATUSES)[number]

export const TickerSchema = z
  .string()
  .trim()
  .transform((val) => val.toUpperCase().replace(/\.JK$/i, ''))
  .refine((val) => /^[A-Z]{4}$/.test(val), {
    message: 'Kode saham harus berupa 4 huruf IDX, contoh: BBCA atau BBCA.JK',
  })

export const AddWatchlistSchema = z
  .object({
    ticker: TickerSchema,
    name: z.string().trim().max(255).optional(),
    targetPrice: z.number().positive().finite().nullable().optional(),
    notes: z.string().max(2000, 'Catatan maksimal 2.000 karakter.').nullable().optional(),
    priority: z.enum(WATCHLIST_PRIORITIES).default('MEDIUM'),
    status: z.enum(WATCHLIST_STATUSES).default('WATCHING'),
    lastPrice: z.number().positive().finite().nullable().optional(),
    lastPriceDate: z.string().nullable().optional(),
    lastChange: z.number().finite().nullable().optional(),
  })
  .strict()

export const UpdateWatchlistSchema = z
  .object({
    targetPrice: z.number().positive().finite().nullable().optional(),
    notes: z.string().max(2000, 'Catatan maksimal 2.000 karakter.').nullable().optional(),
    priority: z.enum(WATCHLIST_PRIORITIES).optional(),
    status: z.enum(WATCHLIST_STATUSES).optional(),
  })
  .strict()

export type AddWatchlistInput = z.infer<typeof AddWatchlistSchema>
export type UpdateWatchlistInput = z.infer<typeof UpdateWatchlistSchema>

export interface WatchlistItemDTO {
  id: number
  userId: string
  ticker: string
  name: string
  targetPrice: number | null
  legacyTargetPrice?: string | null
  notes: string | null
  priority: WatchlistPriority
  status: WatchlistStatus
  lastPrice: number | null
  lastPriceDate: string | null
  lastChange: number | null // Fraction
  createdAt: string
  updatedAt: string
}
