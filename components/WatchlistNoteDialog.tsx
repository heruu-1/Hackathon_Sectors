'use client'

import { useState } from 'react'

import { Button, Dialog } from '@/components/ui'

export interface WatchlistNoteDialogProps {
  open: boolean
  onClose: () => void
  item: { id: number; ticker: string; notes?: string | null } | null
  onSave: (id: number, notes: string) => Promise<boolean>
}

export function WatchlistNoteDialog({ open, onClose, item, onSave }: WatchlistNoteDialogProps) {
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [prevItemId, setPrevItemId] = useState<number | null>(item?.id ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (item && item.id !== prevItemId) {
    setPrevItemId(item.id)
    setNotes(item.notes ?? '')
    setError('')
    setSaving(false)
  }

  if (!item) return null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const ok = await onSave(item.id, notes.trim())
      if (ok) {
        onClose()
      } else {
        setError('Gagal menyimpan catatan.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan catatan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Catatan untuk ${item.ticker}`}
      description="Tambahkan atau perbarui catatan riset pribadi Anda untuk emiten ini."
      role="form"
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label
            htmlFor="watchlist-notes-input"
            className="block text-xs font-semibold text-[var(--rasi-muted)]"
          >
            Catatan riset (maksimal 2.000 karakter)
          </label>
          <textarea
            id="watchlist-notes-input"
            rows={4}
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tuliskan alasan memantau, rencana harga beli, atau hal yang perlu dicermati…"
            className="mt-1.5 w-full rounded-lg border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-3 text-sm text-[var(--rasi-text)] outline-none focus:border-[var(--rasi-primary)] focus:ring-2 focus:ring-[var(--rasi-primary)]/20"
          />
          <div className="mt-1 flex justify-end text-[11px] text-[var(--rasi-muted)]">
            <span>{notes.length}/2000 karakter</span>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--rasi-border)] pt-2">
          <Button variant="secondary" size="md" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            pending={saving}
            pendingText="Menyimpan…"
          >
            Simpan catatan
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
