import type { Metadata } from 'next'

import { ResearchShell } from '@/components/ResearchShell'
import { ThemePreferenceProvider } from '@/components/ThemePreferenceProvider'

import './globals.css'

export const metadata: Metadata = {
  title: 'RASI | Riset Saham Indonesia',
  description:
    'Cari dan bandingkan saham Indonesia. Lihat harga, laporan keuangan, berita, dan penjelasan istilahnya.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('rasi-theme');if(t==='light'||t==='dark')document.documentElement.dataset.rasiTheme=t}catch(e){}})()",
          }}
        />
      </head>
      <body className="min-h-full">
        <ThemePreferenceProvider>
          <ResearchShell>{children}</ResearchShell>
        </ThemePreferenceProvider>
      </body>
    </html>
  )
}
