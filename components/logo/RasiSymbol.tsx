'use client'

import React from 'react'

export interface RasiSymbolProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number
  className?: string
  animated?: boolean
  variant?: 'cyan' | 'white' | 'monochrome' | 'navy'
}

import {
  RASI_CONSTELLATION_NODES,
  RASI_SATELLITE_NODES,
  RASI_PATH_D,
} from './constants'

export { RASI_CONSTELLATION_NODES, RASI_SATELLITE_NODES, RASI_PATH_D }

const SIZE_MAP: Record<string, number> = {
  xs: 18,
  sm: 24,
  md: 36,
  lg: 48,
  xl: 72,
  '2xl': 96,
}

export function RasiSymbol({
  size = 'md',
  className = '',
  animated = false,
  variant = 'cyan',
}: RasiSymbolProps) {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] || 36
  const idSuffix = React.useId().replace(/:/g, '')

  // Color tokens
  const strokeColor =
    variant === 'monochrome'
      ? 'currentColor'
      : variant === 'navy'
        ? '#080f1e'
        : `url(#rasi-line-grad-${idSuffix})`

  const haloColor =
    variant === 'monochrome'
      ? 'currentColor'
      : variant === 'navy'
        ? '#080f1e'
        : '#38bdf8'

  const starFill =
    variant === 'monochrome'
      ? 'currentColor'
      : variant === 'navy'
        ? '#080f1e'
        : '#ffffff'

  const accentFill =
    variant === 'monochrome'
      ? 'currentColor'
      : variant === 'navy'
        ? '#0284c7'
        : '#38bdf8'

  return (
    <svg
      viewBox="0 0 100 120"
      width={pixelSize}
      height={(pixelSize * 120) / 100}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 select-none overflow-visible ${className}`}
      aria-hidden="true"
    >
      <defs>
        {/* Dynamic Line Gradient (Navy to Cyan to White) */}
        <linearGradient
          id={`rasi-line-grad-${idSuffix}`}
          x1="20"
          y1="14"
          x2="80"
          y2="106"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.85" />
        </linearGradient>

        {/* Primary Star Radiant Glow */}
        <radialGradient
          id={`rasi-star-glow-${idSuffix}`}
          cx="50%"
          cy="50%"
          r="50%"
        >
          <stop offset="0%" stopColor={haloColor} stopOpacity="0.9" />
          <stop offset="35%" stopColor={haloColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={haloColor} stopOpacity="0" />
        </radialGradient>

        {/* Subtle Node Halo */}
        <radialGradient
          id={`rasi-node-halo-${idSuffix}`}
          cx="50%"
          cy="50%"
          r="50%"
        >
          <stop offset="0%" stopColor={haloColor} stopOpacity="0.75" />
          <stop offset="50%" stopColor={haloColor} stopOpacity="0.2" />
          <stop offset="100%" stopColor={haloColor} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Auxiliary subtle chart grid indicator behind S */}
      <g opacity="0.12" stroke="currentColor" strokeWidth="0.5">
        <line x1="16" y1="20" x2="84" y2="20" strokeDasharray="2 3" />
        <line x1="16" y1="60" x2="84" y2="60" strokeDasharray="2 3" />
        <line x1="16" y1="100" x2="84" y2="100" strokeDasharray="2 3" />
      </g>

      {/* Auxiliary Constellation Fine Struts (Connecting to Satellites) */}
      <g opacity="0.28" stroke="currentColor" strokeWidth="0.65" strokeDasharray="1.5 2">
        <line x1="76" y1="20" x2="84" y2="34" />
        <line x1="46" y1="60" x2="62" y2="48" />
        <line x1="22" y1="98" x2="32" y2="88" />
      </g>

      {/* Main Stock-Chart S Constellation Line */}
      <path
        d={RASI_PATH_D}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={animated ? 'animate-pulse' : ''}
      />

      {/* Satellite Micro Data Points */}
      {RASI_SATELLITE_NODES.map((s) => (
        <circle
          key={s.id}
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill={accentFill}
          fillOpacity={s.opacity}
        />
      ))}

      {/* Constellation Nodes (Data Points) */}
      {RASI_CONSTELLATION_NODES.map((node) => {
        if (node.isPrimary) {
          return (
            <g key={node.id}>
              {/* Star Glow Aura */}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.r * 2.8}
                fill={`url(#rasi-star-glow-${idSuffix})`}
              />

              {/* 4-Point Star Sparkle / Flare on Breakout Pivot */}
              <path
                d={`M ${node.x} ${node.y - node.r * 2.2} 
                    Q ${node.x} ${node.y} ${node.x + node.r * 2.2} ${node.y} 
                    Q ${node.x} ${node.y} ${node.x} ${node.y + node.r * 2.2} 
                    Q ${node.x} ${node.y} ${node.x - node.r * 2.2} ${node.y} 
                    Z`}
                fill={starFill}
                opacity="0.95"
              />

              {/* Central Core Star Node */}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.r}
                fill={starFill}
                stroke={accentFill}
                strokeWidth="1.2"
              />
            </g>
          )
        }

        return (
          <g key={node.id}>
            {/* Soft halo */}
            <circle
              cx={node.x}
              cy={node.y}
              r={node.r * 2}
              fill={`url(#rasi-node-halo-${idSuffix})`}
            />
            {/* Core Node Point */}
            <circle
              cx={node.x}
              cy={node.y}
              r={node.r}
              fill={starFill}
              stroke={accentFill}
              strokeWidth="0.8"
            />
          </g>
        )
      })}
    </svg>
  )
}
