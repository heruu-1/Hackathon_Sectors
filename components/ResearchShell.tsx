'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  BookOpen,
  Bot,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Radar,
  Search,
  Settings,
  Star,
  User,
  X,
} from 'lucide-react'

import { ButtonLink, IconButton } from '@/components/ui'
import { authClient } from '@/lib/auth-client'

const navLinks = [
  {
    href: '/',
    label: 'Cari saham',
    icon: Search,
    isActive: (pathname: string) => pathname === '/' || pathname.startsWith('/saham'),
  },
  {
    href: '/radar',
    label: 'Radar',
    icon: Radar,
    isActive: (pathname: string) => pathname.startsWith('/radar'),
  },
  {
    href: '/watchlist',
    label: 'Pantauan',
    icon: Star,
    isActive: (pathname: string) =>
      pathname.startsWith('/watchlist') || pathname.startsWith('/riwayat'),
  },
  {
    href: '/asisten',
    label: 'Asisten',
    icon: Bot,
    isActive: (pathname: string) => pathname.startsWith('/asisten'),
  },
  {
    href: '/belajar',
    label: 'Belajar',
    icon: BookOpen,
    isActive: (pathname: string) => pathname.startsWith('/belajar'),
  },
]

export function ResearchShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const { data: session } = authClient.useSession()

  // Close mobile menu on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false)
  }, [pathname])

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  return (
    <div className="rasi-app min-h-screen bg-[var(--rasi-bg)] text-[var(--rasi-text)]">
      <a href="#main-content" className="rasi-skip-link">
        Lewati ke konten utama
      </a>

      {/* Desktop Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[var(--rasi-border)] bg-[var(--rasi-surface)] transition-[width] duration-200 lg:flex ${
          collapsed ? 'w-[76px]' : 'w-64'
        }`}
        aria-label="Navigasi desktop"
      >
        <div className="flex h-16 items-center justify-between border-b border-[var(--rasi-border)] px-4">
          <Link
            href="/"
            className="flex items-center gap-3 font-semibold focus-visible:outline-none"
            aria-label="RASI - Beranda"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--rasi-primary)] font-black text-[var(--rasi-primary-text)]">
              R
            </span>
            {!collapsed && (
              <div className="overflow-hidden">
                <span className="block text-base font-bold tracking-tight">RASI</span>
                <span className="block text-[11px] text-[var(--rasi-muted)]">
                  Riset Saham Indonesia
                </span>
              </div>
            )}
          </Link>
          <IconButton
            icon={collapsed ? ChevronRight : ChevronLeft}
            aria-label={collapsed ? 'Perluas bilah samping' : 'Ringkas bilah samping'}
            size="sm"
            onClick={() => setCollapsed((val) => !val)}
          />
        </div>

        <nav aria-label="Menu utama" className="flex-1 space-y-1 overflow-y-auto p-3">
          {navLinks.map(({ href, label, icon: Icon, isActive }) => {
            const active = isActive(pathname)
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[var(--rasi-active-bg)] font-semibold text-[var(--rasi-primary)]'
                    : 'text-[var(--rasi-muted)] hover:bg-[var(--rasi-muted-bg)] hover:text-[var(--rasi-text)]'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {!collapsed && <span>{label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Desktop Utility Area */}
        <div className="space-y-1 border-t border-[var(--rasi-border)] p-3">
          <Link
            href="/pengaturan"
            title={collapsed ? 'Pengaturan' : undefined}
            className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
              pathname.startsWith('/pengaturan')
                ? 'bg-[var(--rasi-active-bg)] font-semibold text-[var(--rasi-primary)]'
                : 'text-[var(--rasi-muted)] hover:bg-[var(--rasi-muted-bg)] hover:text-[var(--rasi-text)]'
            }`}
          >
            <Settings className="h-5 w-5 shrink-0" aria-hidden="true" />
            {!collapsed && <span>Pengaturan</span>}
          </Link>

          {!collapsed && (
            <p className="mt-2 px-3 text-[11px] leading-relaxed text-[var(--rasi-muted)]">
              Informasi publik dapat dibaca tanpa login.
            </p>
          )}
        </div>
      </aside>

      {/* Main layout wrapper */}
      <div
        className={`flex min-h-screen flex-col transition-[padding] duration-200 lg:pl-64 ${
          collapsed ? 'lg:pl-[76px]' : ''
        }`}
      >
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--rasi-border)] bg-[var(--rasi-surface)]/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <IconButton
              icon={Menu}
              aria-label="Buka menu navigasi"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
            />
            <div className="flex items-center gap-2 lg:hidden">
              <span className="flex h-7 w-7 items-center justify-center rounded bg-[var(--rasi-primary)] text-xs font-bold text-[var(--rasi-primary-text)]">
                R
              </span>
              <span className="text-sm font-bold tracking-tight">RASI</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {session?.user ? (
              <div className="flex items-center gap-2">
                <span className="hidden items-center gap-1.5 text-xs font-medium text-[var(--rasi-muted)] sm:inline-flex">
                  <User className="h-3.5 w-3.5" aria-hidden="true" />
                  {session.user.name || session.user.email}
                </span>
                <IconButton
                  icon={LogOut}
                  aria-label="Keluar dari akun"
                  size="sm"
                  variant="ghost"
                  title="Keluar dari akun"
                  onClick={() => void authClient.signOut()}
                />
              </div>
            ) : (
              <ButtonLink href="/masuk" variant="primary" size="sm">
                Masuk
              </ButtonLink>
            )}
          </div>
        </header>

        {/* Mobile Navigation Dialog */}
        {mobileOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu navigasi utama"
            className="fixed inset-0 z-50 flex lg:hidden"
          >
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />

            {/* Panel */}
            <div className="relative flex w-full max-w-xs flex-1 flex-col bg-[var(--rasi-surface)] text-[var(--rasi-text)] shadow-xl">
              <div className="flex h-16 items-center justify-between border-b border-[var(--rasi-border)] px-4">
                <div className="flex items-center gap-2 font-bold">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--rasi-primary)] text-sm text-[var(--rasi-primary-text)]">
                    R
                  </span>
                  <span>RASI</span>
                </div>
                <IconButton
                  icon={X}
                  aria-label="Tutup menu navigasi"
                  size="sm"
                  onClick={() => setMobileOpen(false)}
                />
              </div>

              <nav aria-label="Menu mobile" className="flex-1 space-y-1 overflow-y-auto p-4">
                {navLinks.map(({ href, label, icon: Icon, isActive }) => {
                  const active = isActive(pathname)
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                        active
                          ? 'bg-[var(--rasi-active-bg)] font-semibold text-[var(--rasi-primary)]'
                          : 'text-[var(--rasi-muted)] hover:bg-[var(--rasi-muted-bg)] hover:text-[var(--rasi-text)]'
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                      <span>{label}</span>
                    </Link>
                  )
                })}
              </nav>

              <div className="space-y-2 border-t border-[var(--rasi-border)] p-4">
                <Link
                  href="/pengaturan"
                  onClick={() => setMobileOpen(false)}
                  className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                    pathname.startsWith('/pengaturan')
                      ? 'bg-[var(--rasi-active-bg)] font-semibold text-[var(--rasi-primary)]'
                      : 'text-[var(--rasi-muted)] hover:bg-[var(--rasi-muted-bg)] hover:text-[var(--rasi-text)]'
                  }`}
                >
                  <Settings className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>Pengaturan</span>
                </Link>

                {session?.user ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false)
                      void authClient.signOut()
                    }}
                    className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-[var(--rasi-danger)] hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>Keluar</span>
                  </button>
                ) : (
                  <ButtonLink
                    href="/masuk"
                    variant="primary"
                    className="w-full"
                    onClick={() => setMobileOpen(false)}
                  >
                    Masuk
                  </ButtonLink>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main
          id="main-content"
          className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6 lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
