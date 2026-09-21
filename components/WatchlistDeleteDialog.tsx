'use client'

import { useState } from 'react'

import { Button, Dialog } from '@/components/ui'

export interface WatchlistDeleteDialogProps {
  open: boolean
  onClose: () => void
  item: { id: number; ticker: string; notes?: string | null } | null
  onConfirm: (id: number) => Promise<boolean>
}

export function WatchlistDeleteDialog({
  open,
  onClose,
  item,
  onConfirm,
}: WatchlistDeleteDialogProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  if (!item) return null

  const handleDelete = async () => {
    setDeleting(true)
    setError('')
    try {
      const ok = await onConfirm(item.id)
      if (ok) {
        onClose()
      } else {
        setError('Gagal menghapus saham dari pantauan.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus pantauan.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Hapus ${item.ticker} dari Pantauan?`}
      description="Konfirmasi penghapusan emiten dari daftar pantauan akun Anda."
      role="form"
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-[var(--rasi-muted)]">
          Apakah Anda yakin ingin menghapus{' '}
          <strong className="text-[var(--rasi-text)]">{item.ticker}</strong> dari daftar pantauan?
          {item.notes ? (
            <span className="mt-2 block text-xs text-amber-700 dark:text-amber-300">
              Perhatian: Catatan riset yang tersimpan untuk emiten ini juga akan terhapus.
            </span>
          ) : null}
        </p>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--rasi-border)] pt-3">
          <Button variant="secondary" size="md" onClick={onClose} disabled={deleting}>
            Batal
          </Button>
          <Button
            variant="destructive"
            size="md"
            onClick={handleDelete}
            pending={deleting}
            pendingText="Menghapus…"
          >
            Hapus dari pantauan
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
