'use client'

import React from 'react'
import { RasiSymbol, type RasiSymbolProps } from './RasiSymbol'

export interface RasiLogoProps {
  layout?: 'horizontal' | 'vertical' | 'symbol-only' | 'wordmark-only'
  symbolSize?: RasiSymbolProps['size']
  variant?: RasiSymbolProps['variant']
  className?: string
  showTagline?: boolean
  animated?: boolean
}

export function RasiLogo({
  layout = 'horizontal',
  symbolSize = 'md',
  variant = 'cyan',
  className = '',
  showTagline = false,
  animated = false,
}: RasiLogoProps) {
  if (layout === 'symbol-only') {
    return <RasiSymbol size={symbolSize} variant={variant} animated={animated} className={className} />
  }

  const isVertical = layout === 'vertical'

  return (
    <div
      className={`inline-flex ${
        isVertical ? 'flex-col items-center text-center' : 'items-center gap-3'
      } ${className}`}
    >
      {layout !== 'wordmark-only' && (
        <RasiSymbol
          size={symbolSize}
          variant={variant}
          animated={animated}
          className={isVertical ? 'mb-2' : ''}
        />
      )}

      <div className={`flex flex-col leading-tight ${isVertical ? 'items-center' : 'items-start'}`}>
        <span className="font-extrabold tracking-[0.18em] text-[var(--rasi-text)] text-base select-none">
          RASI
        </span>
        <span className="text-[10px] font-medium tracking-[0.22em] text-[var(--rasi-muted)] uppercase select-none">
          Riset Saham Indonesia
        </span>
        {showTagline && (
          <span className="mt-1 font-mono text-[9px] tracking-wider text-[var(--rasi-cyan)] opacity-90 select-none">
            Data · Pattern · Insight
          </span>
        )}
      </div>
    </div>
  )
}
