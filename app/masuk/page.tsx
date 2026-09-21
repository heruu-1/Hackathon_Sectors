'use client'

import { Suspense, useState } from 'react'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { ArrowLeft, LogIn } from 'lucide-react'

import { Button } from '@/components/ui'
import { authClient } from '@/lib/auth-client'

function SignInContent() {
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
    <section className="w-full rounded-2xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-6 shadow-sm sm:p-8">
      <Link
        href="/"
        className="mb-8 inline-flex min-h-[44px] items-center gap-2 text-sm text-[var(--rasi-muted)] hover:text-[var(--rasi-text)]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Kembali ke RASI
      </Link>
      <p className="text-sm font-semibold text-[var(--rasi-primary)]">RASI</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Masuk untuk menyimpan riset</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--rasi-muted)]">
        Pantauan, catatan, riwayat, dan percakapan AI tersimpan untuk akun Anda. Data pasar publik
        tetap dapat dibaca tanpa login.
      </p>
      <Button
        type="button"
        onClick={signIn}
        pending={busy}
        pendingText="Menghubungkan ke Google…"
        icon={LogIn}
        className="mt-7 w-full"
      >
        Masuk dengan Google
      </Button>
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
  )
}

export default function SignInPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-xl items-center px-4 py-8">
      <Suspense
        fallback={
          <div className="w-full rounded-2xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-6 text-sm text-[var(--rasi-muted)]">
            Memuat form login…
          </div>
        }
      >
        <SignInContent />
      </Suspense>
    </div>
  )
}
