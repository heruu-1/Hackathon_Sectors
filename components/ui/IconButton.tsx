'use client'

import React, { forwardRef } from 'react'

import { Loader2 } from 'lucide-react'

import type { ButtonSize, ButtonVariant } from './Button'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ComponentType<{ className?: string }>
  'aria-label': string
  variant?: ButtonVariant
  size?: ButtonSize
  pending?: boolean
  disabledReason?: string
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--rasi-primary)] text-[var(--rasi-primary-text)] hover:bg-[var(--rasi-primary-hover)] active:opacity-95 shadow-sm border border-transparent',
  secondary:
    'bg-[var(--rasi-surface)] text-[var(--rasi-text)] border border-[var(--rasi-border)] hover:bg-[var(--rasi-muted-bg)] active:bg-[var(--rasi-muted-bg)]',
  ghost:
    'bg-transparent text-[var(--rasi-muted)] hover:text-[var(--rasi-text)] hover:bg-[var(--rasi-muted-bg)] border border-transparent',
  destructive:
    'bg-[var(--rasi-danger)] text-white hover:bg-red-700 active:bg-red-800 shadow-sm border border-transparent',
}

const sizeStyles: Record<ButtonSize, string> = {
  md: 'min-h-[44px] min-w-[44px] p-2.5 rounded-lg',
  sm: 'min-h-[36px] min-w-[36px] p-2 rounded-lg',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon: Icon,
    'aria-label': ariaLabel,
    variant = 'ghost',
    size = 'md',
    pending = false,
    disabledReason,
    disabled,
    className = '',
    type = 'button',
    ...props
  },
  ref,
) {
  const isDisabled = disabled || pending
  const title = disabledReason || ariaLabel

  return (
    <button
      ref={ref}
      type={type}
      aria-label={ariaLabel}
      title={title}
      disabled={isDisabled}
      aria-busy={pending || undefined}
      aria-disabled={isDisabled || undefined}
      className={`inline-flex items-center justify-center font-medium transition-colors duration-150 select-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {pending ? (
        <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      )}
    </button>
  )
})
