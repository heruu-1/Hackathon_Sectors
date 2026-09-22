import { Suspense } from 'react'

import { getStockData } from '@/app/actions'
import StockDetail from '@/components/StockDetail'

export default async function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params
  const res = await getStockData(ticker).catch(() => ({ success: false, data: undefined }))

  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-[var(--rasi-muted)]">
          Memuat analisis saham…
        </div>
      }
    >
      <StockDetail ticker={ticker} initialData={res.data} />
    </Suspense>
  )
}
