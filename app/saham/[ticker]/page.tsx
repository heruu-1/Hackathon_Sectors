import { Suspense } from 'react'

import StockDetail from '@/components/StockDetail'

export default async function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-[var(--rasi-muted)]">
          Memuat analisis saham…
        </div>
      }
    >
      <StockDetail ticker={ticker} />
    </Suspense>
  )
}
