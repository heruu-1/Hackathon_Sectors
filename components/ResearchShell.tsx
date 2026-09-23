'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  Bookmark,
  Building2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LogOut,
  Menu,
  Radar,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  User,
  X,
} from 'lucide-react'

import { ButtonLink, IconButton } from '@/components/ui'
import { authClient } from '@/lib/auth-client'
import { RasiSymbol } from '@/components/logo'
import { RasiInitialLoading } from '@/components/loading'

const navLinks = [
  {
    href: '/',
    label: 'Cari saham',
    icon: TrendingUp,
    isActive: (pathname: string) => pathname === '/' || pathname.startsWith('/saham'),
  },
  {
    href: '/radar',
    label: 'Radar',
    icon: Radar,
    isActive: (pathname: string) => pathname.startsWith('/radar'),
  },
  {
    href: '/broker',
    label: 'Broker',
    icon: Building2,
    isActive: (pathname: string) => pathname.startsWith('/broker'),
  },
  {
    href: '/watchlist',
    label: 'Pantauan',
    icon: Bookmark,
    isActive: (pathname: string) =>
      pathname.startsWith('/watchlist') || pathname.startsWith('/riwayat'),
  },
  {
    href: '/asisten',
    label: 'Asisten',
    icon: Sparkles,
    isActive: (pathname: string) => pathname.startsWith('/asisten'),
  },
  {
    href: '/belajar',
    label: 'Belajar',
    icon: GraduationCap,
    isActive: (pathname: string) => pathname.startsWith('/belajar'),
  },
]

export function ResearchShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(true)
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
    <div className="rasi-app relative min-h-screen bg-[var(--rasi-bg)] text-[var(--rasi-text)]">
      {/* RASI Initial Loading Screen (Logo Reveal & Text Collapse) */}
      <RasiInitialLoading />

      {/* ── Aurora Borealis & Galaxy Sky Atmosphere ("Cahaya Khas Langit, Galaksi & Aurora") ── */}
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        {/* 1. Deep Cosmic Radial Void (Kedalaman langit luar angkasa dengan pendar cyan-indigo sangat halus) */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_-15%,rgba(14,165,233,0.05),transparent_75%)] dark:bg-[radial-gradient(ellipse_100%_70%_at_50%_-15%,rgba(14,165,233,0.07),transparent_80%)]" />

        {/* 2. Aurora Borealis Ribbon 1 (Tirai Aurora Hijau-Mint Emerald & Cyan Sangat Redup & Lembut di Atas) */}
        <div
          className="animate-aurora-1 absolute -top-[20%] -left-[10%] h-[550px] w-[125%] -rotate-6 rounded-[100%] opacity-15 blur-[100px] dark:opacity-18"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(16, 185, 129, 0.10) 20%, rgba(56, 189, 248, 0.14) 48%, rgba(99, 102, 241, 0.10) 75%, transparent 100%)',
          }}
        />

        {/* 3. Aurora Borealis Ribbon 2 (Tirai Aurora Ungu-Violet & Biru Laut Dalam Sangat Redup di Kanan) */}
        <div
          className="animate-aurora-2 absolute -top-[5%] -right-[15%] h-[560px] w-[115%] rotate-12 rounded-[100%] opacity-12 blur-[110px] dark:opacity-16"
          style={{
            background:
              'linear-gradient(110deg, transparent 10%, rgba(139, 92, 246, 0.12) 35%, rgba(59, 130, 246, 0.10) 60%, rgba(20, 184, 166, 0.08) 85%, transparent 100%)',
          }}
        />

        {/* 4. Milky Way Galaxy Core (Inti Pendar Galaksi Sangat Redup & Samudra Hening di Atas-Tengah) */}
        <div
          className="animate-galaxy-pulse absolute top-[10%] left-[50%] h-[520px] w-[880px] -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-full opacity-15 blur-[110px] dark:opacity-20"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(56, 189, 248, 0.12) 0%, rgba(99, 102, 241, 0.08) 30%, rgba(168, 85, 247, 0.05) 55%, transparent 80%)',
          }}
        />

        {/* 5. Diagonal Galactic Dust Stream (Lembah Debu Bintang Sangat Samar & Nyaman) */}
        <div
          className="absolute -top-[10%] left-[8%] h-[900px] w-[500px] -rotate-35 rounded-full opacity-10 blur-[120px] dark:opacity-15"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(34, 211, 238, 0.10) 0%, rgba(168, 85, 247, 0.07) 45%, transparent 75%)',
          }}
        />

        {/* 6. Horizon Celestial Airglow (Pendar Kaki Langit Malam Tenang & Sangat Samar di Bawah) */}
        <div
          className="absolute -bottom-[25%] left-1/2 h-[450px] w-[1000px] -translate-x-1/2 rounded-full opacity-12 blur-[140px] dark:opacity-18"
          style={{
            background:
              'radial-gradient(ellipse at bottom, rgba(14, 165, 233, 0.10) 0%, rgba(99, 102, 241, 0.05) 50%, transparent 80%)',
          }}
        />
      </div>

      {/* Constellation ("Rasi Bintang") Background — Deep Space & Nautical Astrolabe Pattern */}
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden text-slate-500 opacity-[0.14] dark:text-slate-100 dark:opacity-[0.25]"
        aria-hidden="true"
      >
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="rasi-star-halo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.85" />
              <stop offset="35%" stopColor="currentColor" stopOpacity="0.25" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
            <pattern
              id="rasi-constellation-pattern"
              width="240"
              height="240"
              patternUnits="userSpaceOnUse"
            >
              {/* ── Constellation 1: Crux / Salib Selatan (top-left) ── */}
              {/* Vertical & horizontal cross lines */}
              <path
                d="M 32 10 L 32 62 M 10 36 L 54 36"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.65"
                strokeOpacity="0.30"
              />
              {/* Extra diagonal arm */}
              <path
                d="M 32 36 L 48 50"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                strokeOpacity="0.20"
                strokeDasharray="1.5 2"
              />
              {/* Alpha Crucis with Star Halo */}
              <circle cx="32" cy="10" r="5.5" fill="url(#rasi-star-halo)" />
              <circle cx="32" cy="10" r="2.2" fill="currentColor" fillOpacity="0.95" />{' '}
              {/* Alpha Crucis */}
              <circle cx="32" cy="62" r="1.6" fill="currentColor" fillOpacity="0.85" />{' '}
              {/* Beta Crucis */}
              <circle cx="10" cy="36" r="1.5" fill="currentColor" fillOpacity="0.80" />{' '}
              {/* Gamma Crucis */}
              <circle cx="54" cy="36" r="2.0" fill="currentColor" fillOpacity="0.90" />{' '}
              {/* Delta Crucis */}
              <circle cx="48" cy="50" r="1.0" fill="currentColor" fillOpacity="0.70" />{' '}
              {/* Epsilon Crucis */}
              {/* ── Constellation 2: Orion's Belt + Shoulders (center-left) ── */}
              {/* Belt: 3 collinear stars */}
              <path
                d="M 88 100 L 112 92 L 136 100"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.65"
                strokeOpacity="0.32"
              />
              {/* Shoulders connecting to belt */}
              <path
                d="M 75 72 L 88 100 M 128 68 L 136 100"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                strokeOpacity="0.22"
                strokeDasharray="2 2.5"
              />
              <circle cx="88" cy="100" r="2.0" fill="currentColor" fillOpacity="0.90" /> {/* Alnitak */}
              {/* Alnilam with Star Halo — brightest of belt */}
              <circle cx="112" cy="92" r="6.5" fill="url(#rasi-star-halo)" />
              <circle cx="112" cy="92" r="2.4" fill="currentColor" fillOpacity="1.0" />
              <circle cx="136" cy="100" r="1.8" fill="currentColor" fillOpacity="0.85" />
              {/* Mintaka */}
              <circle cx="75" cy="72" r="1.8" fill="currentColor" fillOpacity="0.85" />{' '}
              {/* Betelgeuse */}
              <circle cx="128" cy="68" r="1.7" fill="currentColor" fillOpacity="0.85" /> {/* Rigel */}
              {/* ── Constellation 3: Cassiopeia W-shape (top-right) ── */}
              <path
                d="M 162 18 L 177 38 L 194 16 L 212 36 L 228 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.65"
                strokeOpacity="0.30"
              />
              <circle cx="162" cy="18" r="1.6" fill="currentColor" fillOpacity="0.80" />
              <circle cx="177" cy="38" r="1.3" fill="currentColor" fillOpacity="0.75" />
              {/* Alpha Cas with Star Halo */}
              <circle cx="194" cy="16" r="5.5" fill="url(#rasi-star-halo)" />
              <circle cx="194" cy="16" r="2.2" fill="currentColor" fillOpacity="0.95" />{' '}
              {/* Alpha Cas — brightest */}
              <circle cx="212" cy="36" r="1.5" fill="currentColor" fillOpacity="0.80" />
              <circle cx="228" cy="16" r="1.4" fill="currentColor" fillOpacity="0.75" />
              {/* ── Constellation 4: Navigation Arc (bottom-left) ── */}
              <path
                d="M 14 158 L 44 178 L 76 165 L 104 182"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.6"
                strokeOpacity="0.28"
              />
              <circle cx="14" cy="158" r="1.6" fill="currentColor" fillOpacity="0.80" />
              <circle cx="44" cy="178" r="2.0" fill="currentColor" fillOpacity="0.90" />
              <circle cx="76" cy="165" r="1.4" fill="currentColor" fillOpacity="0.75" />
              <circle cx="104" cy="182" r="1.7" fill="currentColor" fillOpacity="0.82" />
              {/* ── Constellation 5: Lyra / Vega Diamond (bottom-right) ── */}
              <path
                d="M 178 138 L 208 152 L 192 188 L 162 172 Z M 178 138 L 192 188"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.65"
                strokeOpacity="0.30"
              />
              {/* Vega with Star Halo — very bright */}
              <circle cx="178" cy="138" r="7.0" fill="url(#rasi-star-halo)" />
              <circle cx="178" cy="138" r="2.5" fill="currentColor" fillOpacity="0.98" />
              <circle cx="208" cy="152" r="1.5" fill="currentColor" fillOpacity="0.80" />
              <circle cx="192" cy="188" r="1.7" fill="currentColor" fillOpacity="0.82" />
              <circle cx="162" cy="172" r="1.3" fill="currentColor" fillOpacity="0.75" />
              {/* ── Tile boundary seamless connectors ── */}
              <path
                d="M 0 100 L 14 106 M 226 100 L 240 106"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.45"
                strokeOpacity="0.18"
                strokeDasharray="1.5 2"
              />
              <path
                d="M 112 0 L 108 12 M 112 228 L 108 240"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.45"
                strokeOpacity="0.18"
                strokeDasharray="1.5 2"
              />
              {/* ── Subtle celestial grid cross (tile center reference) ── */}
              <path
                d="M 117 120 H 123 M 120 117 V 123"
                stroke="currentColor"
                strokeWidth="0.45"
                strokeOpacity="0.15"
              />
              {/* ── Scattered micro-stars (adaptive starlight depth) ── */}
              <circle cx="62" cy="8" r="0.9" fill="currentColor" fillOpacity="0.60" />
              <circle cx="95" cy="28" r="0.7" fill="currentColor" fillOpacity="0.50" />
              <circle cx="148" cy="46" r="1.1" fill="currentColor" fillOpacity="0.60" />
              <circle cx="18" cy="75" r="0.8" fill="currentColor" fillOpacity="0.50" />
              <circle cx="220" cy="65" r="1.0" fill="currentColor" fillOpacity="0.60" />
              <circle cx="68" cy="118" r="0.9" fill="currentColor" fillOpacity="0.50" />
              <circle cx="158" cy="108" r="1.2" fill="currentColor" fillOpacity="0.65" />
              <circle cx="132" cy="132" r="0.8" fill="currentColor" fillOpacity="0.50" />
              <circle cx="48" cy="138" r="1.0" fill="currentColor" fillOpacity="0.55" />
              <circle cx="232" cy="120" r="0.9" fill="currentColor" fillOpacity="0.55" />
              <circle cx="116" cy="212" r="1.0" fill="currentColor" fillOpacity="0.60" />
              <circle cx="148" cy="224" r="0.8" fill="currentColor" fillOpacity="0.50" />
              <circle cx="222" cy="208" r="1.1" fill="currentColor" fillOpacity="0.55" />
              <circle cx="6" cy="196" r="0.9" fill="currentColor" fillOpacity="0.50" />
              <circle cx="236" cy="178" r="1.0" fill="currentColor" fillOpacity="0.60" />
              <circle cx="142" cy="72" r="0.8" fill="currentColor" fillOpacity="0.50" />
              <circle cx="22" cy="116" r="0.7" fill="currentColor" fillOpacity="0.45" />
              <circle cx="186" cy="82" r="1.0" fill="currentColor" fillOpacity="0.55" />
              <circle cx="56" cy="56" r="0.8" fill="currentColor" fillOpacity="0.45" />
              <circle cx="106" cy="148" r="0.9" fill="currentColor" fillOpacity="0.50" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#rasi-constellation-pattern)" />
        </svg>
      </div>

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
        <div
          className={`flex h-16 items-center border-b border-[var(--rasi-border)] ${
            collapsed ? 'justify-between px-3' : 'justify-between px-4'
          }`}
        >
          <Link
            href="/"
            className="group relative flex items-center gap-3 font-semibold focus-visible:outline-none"
            aria-label="RASI - Beranda"
          >
            <RasiSymbol size={30} variant="cyan" />
            {!collapsed ? (
              <div className="overflow-hidden leading-tight">
                <span className="block text-base font-extrabold tracking-[0.16em]">RASI</span>
                <span className="block text-[10px] font-medium tracking-wider text-[var(--rasi-muted)] uppercase">
                  Riset Saham Indonesia
                </span>
              </div>
            ) : (
              <div
                role="tooltip"
                className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 hidden items-center whitespace-nowrap rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--rasi-text)] shadow-xl ring-1 ring-black/5 group-hover:flex animate-in fade-in-0 zoom-in-95 duration-100"
              >
                RASI (Beranda)
                <span
                  aria-hidden="true"
                  className="absolute -left-1 top-1/2 -translate-y-1/2 h-2 w-2 -rotate-45 border-t border-l border-[var(--rasi-border)] bg-[var(--rasi-surface)]"
                />
              </div>
            )}
          </Link>
          <div className="group relative">
            <IconButton
              icon={collapsed ? ChevronRight : ChevronLeft}
              aria-label={collapsed ? 'Kembangkan sidebar' : 'Sembunyikan nama menu'}
              size="sm"
              onClick={() => setCollapsed((val) => !val)}
            />
            {collapsed && (
              <div
                role="tooltip"
                className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 hidden items-center whitespace-nowrap rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--rasi-text)] shadow-xl ring-1 ring-black/5 group-hover:flex animate-in fade-in-0 zoom-in-95 duration-100"
              >
                Kembangkan Sidebar
                <span
                  aria-hidden="true"
                  className="absolute -left-1 top-1/2 -translate-y-1/2 h-2 w-2 -rotate-45 border-t border-l border-[var(--rasi-border)] bg-[var(--rasi-surface)]"
                />
              </div>
            )}
          </div>
        </div>

        <nav
          aria-label="Menu utama"
          className={`flex-1 space-y-1 p-3 ${collapsed ? 'overflow-visible' : 'overflow-y-auto'}`}
        >
          {navLinks.map(({ href, label, icon: Icon, isActive }) => {
            const active = isActive(pathname)
            return (
              <Link
                key={href}
                href={href}
                className={`group relative flex min-h-[44px] items-center rounded-lg text-sm font-medium transition-colors ${
                  collapsed ? 'justify-center px-0' : 'gap-3 px-3'
                } ${
                  active
                    ? 'bg-[var(--rasi-active-bg)] font-semibold text-[var(--rasi-primary)]'
                    : 'text-[var(--rasi-muted)] hover:bg-[var(--rasi-muted-bg)] hover:text-[var(--rasi-text)]'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {!collapsed ? (
                  <span>{label}</span>
                ) : (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 hidden items-center whitespace-nowrap rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--rasi-text)] shadow-xl ring-1 ring-black/5 group-hover:flex animate-in fade-in-0 zoom-in-95 duration-100"
                  >
                    {label}
                    <span
                      aria-hidden="true"
                      className="absolute -left-1 top-1/2 -translate-y-1/2 h-2 w-2 -rotate-45 border-t border-l border-[var(--rasi-border)] bg-[var(--rasi-surface)]"
                    />
                  </div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Desktop Utility Area */}
        <div className="space-y-1 border-t border-[var(--rasi-border)] p-3">
          <Link
            href="/pengaturan"
            className={`group relative flex min-h-[44px] items-center rounded-lg text-sm font-medium transition-colors ${
              collapsed ? 'justify-center px-0' : 'gap-3 px-3'
            } ${
              pathname.startsWith('/pengaturan')
                ? 'bg-[var(--rasi-active-bg)] font-semibold text-[var(--rasi-primary)]'
                : 'text-[var(--rasi-muted)] hover:bg-[var(--rasi-muted-bg)] hover:text-[var(--rasi-text)]'
            }`}
          >
            <SlidersHorizontal className="h-5 w-5 shrink-0" aria-hidden="true" />
            {!collapsed ? (
              <span>Pengaturan</span>
            ) : (
              <div
                role="tooltip"
                className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 hidden items-center whitespace-nowrap rounded-md border border-[var(--rasi-border)] bg-[var(--rasi-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--rasi-text)] shadow-xl ring-1 ring-black/5 group-hover:flex animate-in fade-in-0 zoom-in-95 duration-100"
              >
                Pengaturan
                <span
                  aria-hidden="true"
                  className="absolute -left-1 top-1/2 -translate-y-1/2 h-2 w-2 -rotate-45 border-t border-l border-[var(--rasi-border)] bg-[var(--rasi-surface)]"
                />
              </div>
            )}
          </Link>

          {!collapsed && (
            <p className="mt-2 px-3 text-[11px] leading-relaxed text-[var(--rasi-muted)]">
              {' '}
              Data saham bisa dilihat tanpa masuk.{' '}
            </p>
          )}
        </div>
      </aside>

      {/* Main layout wrapper */}
      <div
        className={`relative z-10 isolate flex min-h-screen flex-col transition-[padding] duration-200 lg:pl-64 ${
          collapsed ? 'lg:pl-[76px]' : ''
        }`}
      >
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--rasi-border)] bg-[var(--rasi-surface)]/90 backdrop-blur-md px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <IconButton
              icon={Menu}
              aria-label="Buka menu navigasi"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
            />
            <div className="flex items-center gap-2.5 lg:hidden">
              <RasiSymbol size={24} variant="cyan" />
              <span className="text-sm font-extrabold tracking-[0.16em]">RASI</span>
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
                <div className="flex items-center gap-2.5 font-bold">
                  <RasiSymbol size={26} variant="cyan" />
                  <div className="leading-tight">
                    <span className="block text-sm font-extrabold tracking-[0.16em]">RASI</span>
                    <span className="block text-[9px] font-medium tracking-wider text-[var(--rasi-muted)] uppercase">
                      Riset Saham Indonesia
                    </span>
                  </div>
                </div>
                <IconButton
                  icon={X}
                  aria-label="Tutup menu navigasi"
                  size="sm"
                  onClick={() => setMobileOpen(false)}
                />
              </div>

              <nav aria-label="Menu utama" className="flex-1 space-y-1 overflow-y-auto p-4">
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
                  <SlidersHorizontal className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>Pengaturan</span>
                </Link>

                {session?.user ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false)
                      void authClient.signOut()
                    }}
                    className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-[var(--rasi-danger)] hover:bg-red-50 dark:hover:bg-[#25080c]"
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
          className="relative z-10 mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6 lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
