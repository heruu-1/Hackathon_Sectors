import { Suspense } from 'react'

import { StockSearch } from '@/components/StockSearch'

export default function StocksPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-[var(--rasi-muted)]">
          Memuat pencarian saham…
        </div>
      }
    >
      <StockSearch />
    </Suspense>
  )
}
