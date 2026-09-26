import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'

import { ResearchShell } from '@/components/ResearchShell'
import { ThemePreferenceProvider } from '@/components/ThemePreferenceProvider'

import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta-sans',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'RASI | Riset Saham Indonesia',
  description:
    'Cari dan bandingkan saham Indonesia. Lihat harga, laporan keuangan, berita, dan penjelasan istilahnya.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      data-rasi-theme="dark"
      className={`${plusJakartaSans.variable} h-full font-sans antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('rasi-theme')||'dark';document.documentElement.dataset.rasiTheme=t}catch(e){}})()",
          }}
        />
      </head>
      <body className={`${plusJakartaSans.className} min-h-full font-sans`}>
        <ThemePreferenceProvider>
          <ResearchShell>{children}</ResearchShell>
        </ThemePreferenceProvider>
      </body>
    </html>
  )
}
