import type { Metadata } from 'next'

import { getBrokerActivityAction, getBrokerListAction } from '@/app/actions'
import { BrokerActivityExplorer } from '@/components/BrokerActivityExplorer'

export const metadata: Metadata = {
  title: 'Penelusuran Broker — RASI Market Intelligence',
  description:
    'Telusuri aktivitas transaksi broker, peringkat saham akumulasi dan distribusi, serta perbandingan arah transaksi antara dua broker.',
}

export default async function BrokerPage() {
  const endDate = new Date().toISOString().split('T')[0]
  // eslint-disable-next-line react-hooks/purity
  const startDate = new Date(Date.now() - 4 * 86_400_000).toISOString().split('T')[0]

  const [registryRes, summaryRes] = await Promise.all([
    getBrokerListAction().catch(() => ({ success: false, data: undefined })),
    getBrokerActivityAction('YP', startDate, endDate).catch(() => ({ success: false, data: undefined })),
  ])

  return (
    <div className="space-y-6 py-2">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--rasi-text)] sm:text-3xl">
          Penelusuran & Perbandingan Broker
        </h1>
        <p className="text-sm text-[var(--rasi-muted)]">
          Lihat saham mana yang paling banyak dibeli (akumulasi), dijual (distribusi), atau
          ditransaksikan oleh broker tertentu, serta bandingkan apakah dua broker kompak atau
          berlawanan arah.
        </p>
      </div>

      <BrokerActivityExplorer
        initialRegistry={registryRes.data}
        initialSummary={summaryRes.data}
      />
    </div>
  )
}
