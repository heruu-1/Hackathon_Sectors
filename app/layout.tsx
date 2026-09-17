import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'RASI | Report Analisis Saham Indonesia',
  description:
    'Ruang riset saham Indonesia dengan data, sumber, dan penjelasan AI yang dapat diperiksa.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
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
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
