'use client'

import React, { useEffect, useRef, useState } from 'react'

import { MoreHorizontal } from 'lucide-react'

import { IconButton } from './IconButton'

export interface ActionMenuItem {
  label: string
  onClick: () => void
  icon?: React.ComponentType<{ className?: string }>
  variant?: 'default' | 'destructive'
  disabled?: boolean
}

export interface ActionMenuProps {
  items: ActionMenuItem[]
  'aria-label'?: string
  className?: string
}

export function ActionMenu({
  items,
  'aria-label': ariaLabel = 'Menu tindakan lainnya',
  className = '',
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsOpen(false)
        setFocusedIndex(-1)
        triggerRef.current?.focus()
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        setFocusedIndex((prev) => (prev + 1) % items.length)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setFocusedIndex((prev) => (prev - 1 + items.length) % items.length)
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setFocusedIndex(-1)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, items.length])

  useEffect(() => {
    if (focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.focus()
    }
  }, [focusedIndex])

  return (
    <div ref={menuRef} className={`relative inline-block text-left ${className}`}>
      <IconButton
        ref={triggerRef}
        icon={MoreHorizontal}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        size="sm"
        variant="ghost"
        onClick={() => {
          setIsOpen((prev) => !prev)
          if (!isOpen) setFocusedIndex(0)
        }}
      />

      {isOpen && (
        <div
          role="menu"
          aria-label={ariaLabel}
          className="absolute right-0 z-40 mt-1 min-w-[180px] overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] py-1 shadow-[var(--rasi-card-shadow)]"
        >
          {items.map((item, index) => {
            const Icon = item.icon
            const isDestructive = item.variant === 'destructive'

            return (
              <button
                key={item.label}
                ref={(el) => {
                  itemRefs.current[index] = el
                }}
                role="menuitem"
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setIsOpen(false)
                  item.onClick()
                }}
                className={`flex min-h-[40px] w-full items-center gap-2 px-4 py-2 text-left text-xs font-medium transition-colors select-none focus:outline-none ${
                  isDestructive
                    ? 'text-[var(--rasi-danger)] hover:bg-red-50 dark:hover:bg-[#25080c]'
                    : 'text-[var(--rasi-text)] hover:bg-[var(--rasi-muted-bg)]'
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
