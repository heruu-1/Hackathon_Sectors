'use client'

import React, { useEffect, useRef } from 'react'

import { X } from 'lucide-react'

import { IconButton } from './IconButton'

export type DialogRole = 'preview' | 'read' | 'form'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  role?: DialogRole
  maxWidth?: 'sm' | 'md' | 'lg' | 'preview'
  closeOnBackdrop?: boolean
  children: React.ReactNode
  className?: string
}

const maxWidthStyles = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  preview: 'max-w-[720px]',
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  role = 'read',
  maxWidth = role === 'preview' ? 'preview' : 'md',
  closeOnBackdrop = role !== 'form',
  children,
  className = '',
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerElementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      triggerElementRef.current = document.activeElement as HTMLElement | null
      if (!dialog.open) {
        try {
          dialog.showModal()
        } catch {
          // Fallback if already open or polyfill needed
        }
      }
    } else {
      if (dialog.open) {
        dialog.close()
      }
      if (triggerElementRef.current && typeof triggerElementRef.current.focus === 'function') {
        triggerElementRef.current.focus()
      }
    }
  }, [open])

  const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement, Event>) => {
    event.preventDefault()
    onClose()
  }

  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (!closeOnBackdrop) return
    const dialog = dialogRef.current
    if (!dialog) return

    const rect = dialog.getBoundingClientRect()
    const isOutside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom

    if (isOutside) {
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      aria-labelledby="dialog-title"
      aria-describedby={description ? 'dialog-description' : undefined}
      className={`fixed inset-0 z-50 m-auto max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl border border-[var(--rasi-border)] bg-[var(--rasi-surface)] p-0 text-[var(--rasi-text)] shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-xs ${maxWidthStyles[maxWidth]} ${className}`}
    >
      <div className="flex items-start justify-between border-b border-[var(--rasi-border)] px-6 py-4">
        <div>
          <h2 id="dialog-title" className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {description && (
            <p id="dialog-description" className="mt-1 text-xs text-[var(--rasi-muted)]">
              {description}
            </p>
          )}
        </div>
        <IconButton
          icon={X}
          aria-label="Tutup dialog"
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="-mt-1 -mr-2"
        />
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  )
}
