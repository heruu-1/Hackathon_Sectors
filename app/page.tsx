import { Suspense } from 'react'

import { MarketOverview } from '@/components/MarketOverview'
import { StockSearch } from '@/components/StockSearch'

export default function HomePage() {
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
        <MarketOverview />
      </Suspense>
    </div>
  )
}
