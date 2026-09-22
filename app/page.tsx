import { Suspense } from 'react'

import { getMarketOverviewAction } from '@/app/actions'
import { MarketOverview } from '@/components/MarketOverview'
import { StockSearch } from '@/components/StockSearch'

export default async function HomePage() {
  const marketData = await getMarketOverviewAction().catch(() => ({
    success: false,
    data: undefined,
  }))

  return (
    <div className="space-y-8">
      <Suspense
        fallback={
          <div className="py-12 text-center text-sm text-[var(--rasi-muted)]">
            Memuat pencarian saham…
          </div>
        }
      >
        <StockSearch />
      </Suspense>

      <Suspense
        fallback={
          <div className="py-12 text-center text-sm text-[var(--rasi-muted)]">
            Memuat ringkasan pasar…
          </div>
        }
      >
        <MarketOverview initialData={marketData.data} />
      </Suspense>
    </div>
  )
}
