import type { Metadata } from 'next'
import { Roboto, Roboto_Mono } from 'next/font/google'

import { ResearchShell } from '@/components/ResearchShell'
import { ThemePreferenceProvider } from '@/components/ThemePreferenceProvider'

import './globals.css'

const roboto = Roboto({
  variable: '--font-roboto',
  subsets: ['latin'],
  weight: ['300', '400', '500', '700', '900'],
  display: 'swap',
})

const robotoMono = Roboto_Mono({
  variable: '--font-roboto-mono',
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
      className={`${roboto.variable} ${robotoMono.variable} h-full font-sans antialiased`}
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
      <body className={`${roboto.className} min-h-full font-sans`}>
        <ThemePreferenceProvider>
          <ResearchShell>{children}</ResearchShell>
        </ThemePreferenceProvider>
      </body>
    </html>
  )
}
