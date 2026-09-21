'use client'

import React, { forwardRef } from 'react'

import Link, { type LinkProps } from 'next/link'

import type { ButtonSize, ButtonVariant } from './Button'

export interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: React.ComponentType<{ className?: string }>
  iconPosition?: 'left' | 'right'
  className?: string
  children: React.ReactNode
  title?: string
  target?: string
  rel?: string
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

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  {
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconPosition = 'left',
    className = '',
    children,
    ...props
  },
  ref,
) {
  return (
    <Link
      ref={ref}
      className={`inline-flex items-center justify-center font-medium no-underline transition-colors duration-150 select-none focus-visible:outline-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {Icon && iconPosition === 'left' && (
        <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      )}
      <span>{children}</span>
      {Icon && iconPosition === 'right' && (
        <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      )}
    </Link>
  )
})
