'use client'

import { useState } from 'react'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { ArrowLeft, LogIn } from 'lucide-react'

import { ResearchShell } from '@/components/ResearchShell'
import { authClient } from '@/lib/auth-client'

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function signIn() {
    setBusy(true)
    setError('')
    const callbackURL = searchParams.get('callbackURL') || '/'
    const result = await authClient.signIn.social({
      provider: 'google',
      callbackURL,
    })
    if (result.error) {
      setError(
        'Login Google belum bisa dimulai. Pastikan GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET sudah diisi.',
      )
      setBusy(false)
      return
    }
    router.push(callbackURL)
  }

  return (
    <ResearchShell>
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center px-4 py-10">
        <section className="w-full rounded-2xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-6 shadow-sm sm:p-8">
          <Link
            href="/"
            className="mb-8 inline-flex min-h-11 items-center gap-2 text-sm text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Kembali ke RASI
          </Link>
          <p className="text-sm font-semibold text-[var(--rasi-primary)]">RASI</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Masuk untuk menyimpan riset
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--rasi-muted)]">
            Pantauan, catatan, riwayat, dan percakapan AI tersimpan untuk akun Anda. Data pasar
            publik tetap dapat dibaca tanpa login.
          </p>
          <button
            type="button"
            onClick={signIn}
            disabled={busy}
            className="rasi-button-primary mt-7 w-full justify-center"
          >
            <LogIn size={17} aria-hidden="true" />
            {busy ? 'Menghubungkan ke Google…' : 'Masuk dengan Google'}
          </button>
          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
            >
              {error}
            </p>
          ) : null}
          <p className="mt-5 text-xs leading-5 text-[var(--rasi-muted)]">
            Dengan masuk, Anda memahami bahwa pertanyaan yang dikirim ke Asisten dapat diproses oleh
            Gemini sesuai konfigurasi server.
          </p>
        </section>
      </main>
    </ResearchShell>
  )
}
