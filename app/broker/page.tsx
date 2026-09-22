import type { Metadata } from 'next'

import { BrokerActivityExplorer } from '@/components/BrokerActivityExplorer'

export const metadata: Metadata = {
  title: 'Penelusuran Broker (F04) — RASI Market Intelligence',
  description:
    'Telusuri aktivitas transaksi broker, peringkat saham akumulasi dan distribusi, serta perbandingan arah transaksi antara dua broker.',
}

export default function BrokerPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--rasi-text)] sm:text-3xl">
          Penelusuran & Perbandingan Broker
        </h1>
        <p className="text-sm text-[var(--rasi-muted)]">
          Lihat saham mana yang paling banyak dibeli (akumulasi), dijual (distribusi), atau
          ditransaksikan oleh broker tertentu, serta bandingkan apakah dua broker kompak atau
          berlawanan arah.
        </p>
      </div>

      <BrokerActivityExplorer />
    </div>
  )
}
