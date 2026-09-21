'use client'

import React, { forwardRef } from 'react'

import { Loader2 } from 'lucide-react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'
export type ButtonSize = 'md' | 'sm'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  pending?: boolean
  pendingText?: string
  icon?: React.ComponentType<{ className?: string }>
  iconPosition?: 'left' | 'right'
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
  md: 'min-h-[44px] px-4 py-2 text-sm gap-2 rounded-lg',
  sm: 'min-h-[36px] px-3 py-1.5 text-xs gap-1.5 rounded-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    pending = false,
    pendingText,
    icon: Icon,
    iconPosition = 'left',
    disabledReason,
    disabled,
    className = '',
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  const isDisabled = disabled || pending
  const title = disabledReason || props.title

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      title={title}
      aria-busy={pending || undefined}
      aria-disabled={isDisabled || undefined}
      className={`inline-flex items-center justify-center font-medium transition-colors duration-150 select-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {pending ? (
        <>
          <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin" aria-hidden="true" />
          <span>{pendingText ?? children}</span>
        </>
      ) : (
        <>
          {Icon && iconPosition === 'left' && (
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          )}
          <span>{children}</span>
          {Icon && iconPosition === 'right' && (
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          )}
        </>
      )}
    </button>
  )
})
