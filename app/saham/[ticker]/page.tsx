import { ResearchShell } from '@/components/ResearchShell'
import StockDetail from '@/components/StockDetail'

export default async function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params
  return (
    <ResearchShell>
      <StockDetail ticker={ticker} />
    </ResearchShell>
  )
}
