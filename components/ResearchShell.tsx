'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  BarChart3,
  BookOpen,
  Bot,
  ChevronLeft,
  ChevronRight,
  GitCompareArrows,
  Home,
  Menu,
  Radar,
  Search,
  Settings,
  Star,
  X,
} from 'lucide-react'

const links = [
  { href: '/', label: 'Beranda', icon: Home },
  { href: '/saham', label: 'Cari saham', icon: Search },
  { href: '/screener', label: 'Penyaring', icon: BarChart3 },
  { href: '/radar', label: 'Radar pasar', icon: Radar },
  { href: '/bandingkan', label: 'Bandingkan', icon: GitCompareArrows },
  { href: '/watchlist', label: 'Pantauan saya', icon: Star },
  { href: '/asisten', label: 'Asisten RASI', icon: Bot },
  { href: '/belajar', label: 'Belajar', icon: BookOpen },
]

export function ResearchShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="rasi-app min-h-screen bg-[var(--rasi-bg)] text-[var(--rasi-text)]">
      <a href="#main-content" className="rasi-skip-link">
        Lewati ke konten utama
      </a>
      <button
        type="button"
        aria-label="Buka menu navigasi"
        className="rasi-mobile-menu fixed top-4 left-4 z-50 rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-2 lg:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </button>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Tutup menu"
          className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`rasi-sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--rasi-border)] bg-[var(--rasi-surface)] transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-[76px]' : ''}`}
      >
        <div className="flex h-20 items-center justify-between border-b border-[var(--rasi-border)] px-5">
          <Link href="/" className="flex items-center gap-3" aria-label="RASI beranda">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 font-black text-white">
              R
            </span>
            {!collapsed && (
              <span>
                <span className="block text-lg font-bold tracking-tight">RASI</span>
                <span className="block text-[10px] text-[var(--rasi-muted)]">
                  Riset saham Indonesia
                </span>
              </span>
            )}
          </Link>
          <button
            type="button"
            className="hidden rounded-md p-1.5 text-[var(--rasi-muted)] hover:bg-[var(--rasi-muted-bg)] lg:block"
            aria-label={collapsed ? 'Perluas menu' : 'Ringkas menu'}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          <button
            type="button"
            className="rounded-md p-1.5 text-[var(--rasi-muted)] hover:bg-[var(--rasi-muted-bg)] lg:hidden"
            aria-label="Tutup menu"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav aria-label="Navigasi utama" className="flex-1 space-y-1 overflow-y-auto p-3">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? label : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[var(--rasi-muted)] hover:bg-[var(--rasi-muted-bg)] hover:text-[var(--rasi-text)]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-[var(--rasi-border)] p-3">
          <Link
            href="/pengaturan"
            onClick={() => setMobileOpen(false)}
            title={collapsed ? 'Pengaturan' : undefined}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-[var(--rasi-muted)] hover:bg-[var(--rasi-muted-bg)] hover:text-[var(--rasi-text)]"
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Pengaturan</span>}
          </Link>
          {!collapsed && (
            <p className="mt-3 px-3 text-[11px] leading-relaxed text-[var(--rasi-muted)]">
              Data pasar bukan nasihat investasi. Periksa tanggal dan sumber sebelum mengambil
              keputusan.
            </p>
          )}
        </div>
      </aside>
      <div
        className={`min-h-screen transition-[padding] duration-200 lg:pl-64 ${collapsed ? 'lg:pl-[76px]' : ''}`}
      >
        <header className="sticky top-0 z-30 border-b border-[var(--rasi-border)] bg-[var(--rasi-bg)]/95 backdrop-blur">
          <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-4 px-4 py-3 pl-16 sm:px-6 sm:pl-16 lg:px-8 lg:pl-8">
            <div>
              <p className="text-xs font-medium text-[var(--rasi-muted)]">
                Report Analisis Saham Indonesia
              </p>
              <p className="text-sm font-semibold">Riset dengan bukti, bukan tebakan</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/asisten" className="rasi-button-secondary hidden sm:inline-flex">
                <Bot className="h-4 w-4" /> Tanya AI
              </Link>
              <Link href="/masuk" className="rasi-button-primary">
                Masuk Google
              </Link>
            </div>
          </div>
        </header>
        <main id="main-content" className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  )
}
