'use client'

import React, { useEffect, useState, useId, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RotateCcw, X } from 'lucide-react'

export type LoadingMode = 'text-collapse' | 'logo-reveal'

export interface RasiInitialLoadingProps {
  /** If true, forces the loading screen to display (e.g., for preview in Settings) */
  forceShow?: boolean
  /** Callback fired when loading animation finishes and overlay dismisses */
  onComplete?: () => void
  /** Which animation concept to run: 'logo-reveal' (default) or 'text-collapse' */
  mode?: LoadingMode
  /** Whether the user can manually close / dismiss the loading screen */
  allowSkip?: boolean
  /** Whether preview controls (replay, mode toggle) are shown */
  showControls?: boolean
}

/**
 * Background Deep Space Micro-Starfield (Cosmic Atmosphere)
 */
const DEEP_SPACE_STARS = [
  { x: 35, y: 28, r: 0.8, o: 0.35, delay: 0.1 },
  { x: 88, y: 20, r: 1.1, o: 0.5, delay: 0.5 },
  { x: 135, y: 38, r: 0.7, o: 0.3, delay: 0.9 },
  { x: 215, y: 24, r: 1.2, o: 0.55, delay: 0.2 },
  { x: 275, y: 18, r: 0.8, o: 0.4, delay: 0.7 },
  { x: 345, y: 32, r: 1.0, o: 0.45, delay: 0.4 },
  { x: 382, y: 78, r: 0.7, o: 0.3, delay: 1.1 },
  { x: 24, y: 92, r: 0.9, o: 0.4, delay: 0.6 },
  { x: 42, y: 168, r: 1.1, o: 0.5, delay: 0.3 },
  { x: 105, y: 198, r: 0.8, o: 0.35, delay: 0.8 },
  { x: 185, y: 205, r: 1.2, o: 0.5, delay: 1.0 },
  { x: 260, y: 195, r: 0.7, o: 0.35, delay: 0.2 },
  { x: 335, y: 188, r: 1.0, o: 0.45, delay: 0.7 },
  { x: 382, y: 158, r: 0.8, o: 0.4, delay: 0.5 },
  { x: 18, y: 142, r: 0.6, o: 0.25, delay: 1.2 },
  { x: 372, y: 122, r: 0.9, o: 0.4, delay: 0.4 },
  { x: 200, y: 14, r: 1.0, o: 0.4, delay: 0.9 },
  { x: 308, y: 46, r: 0.7, o: 0.35, delay: 0.3 },
]

/**
 * 26 Astronomical Data Points mapped between:
 * 1. Constellation S Cluster (Stock wave & S-symbol stage)
 * 2. Pure Astrometry Constellation Letters "R-A-S-I" (Straight-line asterism joints)
 */
interface AnimationPoint {
  id: string
  letter: {
    x: number
    y: number
    group: 'R' | 'A' | 'S' | 'I'
    isAlpha?: boolean
    r?: number
  }
  constellation: {
    x: number
    y: number
    isPrimary?: boolean
    r?: number
  }
}

const ANIMATION_POINTS: AnimationPoint[] = [
  // ── Letter 'R' (7 Constellation Stars) ──
  {
    id: 'p-r1',
    letter: { x: 72, y: 70, group: 'R', isAlpha: true, r: 4.4 }, // Alpha-R (Top-Left Star)
    constellation: { x: 158, y: 79, r: 3.8 }, // S-Node n3
  },
  {
    id: 'p-r2',
    letter: { x: 72, y: 105, group: 'R', r: 3.2 }, // Mid-Stem Junction
    constellation: { x: 160, y: 95, r: 2.2 }, // S-Cluster star
  },
  {
    id: 'p-r3',
    letter: { x: 72, y: 140, group: 'R', r: 3.4 }, // Bottom Stem Foot
    constellation: { x: 164, y: 144, r: 3.4 }, // S-Node n8
  },
  {
    id: 'p-r4',
    letter: { x: 106, y: 70, group: 'R', r: 3.2 }, // Loop Top-Right Corner
    constellation: { x: 168, y: 51, r: 4.2 }, // S-Node n2
  },
  {
    id: 'p-r5',
    letter: { x: 118, y: 88, group: 'R', isAlpha: true, r: 3.8 }, // Loop Apex Star
    constellation: { x: 150, y: 40, r: 2.2 }, // Outer Cluster star
  },
  {
    id: 'p-r6',
    letter: { x: 106, y: 105, group: 'R', r: 3.2 }, // Loop Return Corner
    constellation: { x: 145, y: 120, r: 2.2 }, // Outer Cluster star
  },
  {
    id: 'p-r7',
    letter: { x: 120, y: 140, group: 'R', r: 3.6 }, // Diagonal Leg Foot
    constellation: { x: 158, y: 160, r: 2.2 }, // Bottom Cluster star
  },

  // ── Letter 'A' (5 Constellation Stars) ──
  {
    id: 'p-a1',
    letter: { x: 140, y: 140, group: 'A', r: 3.6 }, // Left Foot
    constellation: { x: 176, y: 131, r: 2.4 }, // S-Sat 2
  },
  {
    id: 'p-a2',
    letter: { x: 152, y: 110, group: 'A', r: 3.2 }, // Left Crossbar Node
    constellation: { x: 180, y: 64, r: 2.4 }, // Ambient star
  },
  {
    id: 'p-a3',
    letter: { x: 165, y: 70, group: 'A', isAlpha: true, r: 5.8 }, // PRIMARY ALPHA STAR: Crown of RASI!
    constellation: { x: 195, y: 95, isPrimary: true, r: 5.6 }, // S-Node n4 (Breakout Focal Star)
  },
  {
    id: 'p-a4',
    letter: { x: 178, y: 110, group: 'A', r: 3.2 }, // Right Crossbar Node
    constellation: { x: 192, y: 130, r: 2.2 }, // Ambient star
  },
  {
    id: 'p-a5',
    letter: { x: 190, y: 140, group: 'A', r: 3.6 }, // Right Foot
    constellation: { x: 205, y: 165, r: 2.2 }, // Ambient star
  },

  // ── Letter 'S' (7 Constellation Stars - Matching RASI S Logo Geometry) ──
  {
    id: 'p-s1',
    letter: { x: 252, y: 80, group: 'S', r: 3.4 }, // Top-Right Head
    constellation: { x: 234, y: 43, r: 3.6 }, // S-Node n0
  },
  {
    id: 'p-s2',
    letter: { x: 236, y: 70, group: 'S', r: 3.4 }, // Upper Crest
    constellation: { x: 202, y: 35, r: 4.0 }, // S-Node n1
  },
  {
    id: 'p-s3',
    letter: { x: 218, y: 82, group: 'S', r: 3.4 }, // Upper Left Turn
    constellation: { x: 216, y: 79, r: 2.6 }, // S-Sat 1
  },
  {
    id: 'p-s4',
    letter: { x: 236, y: 105, group: 'S', isAlpha: true, r: 4.8 }, // Alpha-S: Center Pivot Star!
    constellation: { x: 236, y: 110, r: 4.6 }, // S-Node n5
  },
  {
    id: 'p-s5',
    letter: { x: 254, y: 126, group: 'S', r: 3.6 }, // Lower Right Turn
    constellation: { x: 228, y: 139, r: 3.8 }, // S-Node n6
  },
  {
    id: 'p-s6',
    letter: { x: 236, y: 140, group: 'S', r: 3.4 }, // Lower Crest
    constellation: { x: 192, y: 155, r: 4.0 }, // S-Node n7
  },
  {
    id: 'p-s7',
    letter: { x: 218, y: 132, group: 'S', r: 3.2 }, // Lower Left Tail
    constellation: { x: 215, y: 150, r: 2.2 }, // Ambient star
  },

  // ── Letter 'I' (5 Constellation Stars - Pure Vertical Starlight Pillar) ──
  {
    id: 'p-i1',
    letter: { x: 306, y: 70, group: 'I', r: 4.2 }, // Top Star of I
    constellation: { x: 244, y: 61, r: 2.4 }, // S-Sat 0
  },
  {
    id: 'p-i2',
    letter: { x: 306, y: 88, group: 'I', r: 3.2 }, // Upper-mid Star
    constellation: { x: 256, y: 38, r: 2.0 }, // Ambient star
  },
  {
    id: 'p-i3',
    letter: { x: 306, y: 105, group: 'I', r: 3.6 }, // Center Star of I
    constellation: { x: 225, y: 92, r: 2.4 }, // Ambient star
  },
  {
    id: 'p-i4',
    letter: { x: 306, y: 122, group: 'I', r: 3.2 }, // Lower-mid Star
    constellation: { x: 242, y: 125, r: 2.2 }, // Ambient star
  },
  {
    id: 'p-i5',
    letter: { x: 306, y: 140, group: 'I', r: 4.0 }, // Bottom Star of I
    constellation: { x: 210, y: 168, r: 2.0 }, // Bottom halo star
  },
]

// Constellation S main path passing through official nodes n0 -> n1 -> n2 -> n3 -> n4 -> n5 -> n6 -> n7 -> n8
const S_CONSTELLATION_PATH_D =
  'M 234 43 L 202 35 L 168 51 L 158 79 L 195 95 L 236 110 L 228 139 L 192 155 L 164 144'

// Satellite filaments for S-constellation
const S_SATELLITE_LINES = [
  { x1: 234, y1: 43, x2: 244, y2: 61 }, // n0 -> sat0
  { x1: 195, y1: 95, x2: 216, y2: 79 }, // n4 -> sat1
  { x1: 164, y1: 144, x2: 176, y2: 131 }, // n8 -> sat2
]

/**
 * PURE ASTRONOMICAL ASTERISMS FOR "R A S I"
 * In star maps and constellations, asterisms are straight starlight filaments
 * linking star to star with celestial geometry.
 * Clean, distinct, and unmistakable sans-serif constellation typography.
 */
const LETTER_ASTERISMS = [
  // ── Constellation 'R' ──
  { id: 'r-stem', d: 'M 72 140 L 72 70', delay: 0.0 }, // Vertical spine
  { id: 'r-loop', d: 'M 72 70 L 104 70 L 114 88 L 104 105 L 72 105', delay: 0.08 }, // Polygonal asterism head
  { id: 'r-leg', d: 'M 72 105 L 116 140', delay: 0.16 }, // Diagonal starlight leg

  // ── Constellation 'A' ──
  { id: 'a-left', d: 'M 140 140 L 165 70', delay: 0.04 }, // Left starlight beam
  { id: 'a-right', d: 'M 165 70 L 190 140', delay: 0.12 }, // Right starlight beam
  { id: 'a-bar', d: 'M 150 112 L 180 112', delay: 0.2 }, // Crossbar asterism

  // ── Constellation 'S' (Iconic RASI S Geometry) ──
  {
    id: 's-asterism',
    d: 'M 250 80 L 236 70 L 218 82 L 235 105 L 252 126 L 236 140 L 220 132',
    delay: 0.1,
  },

  // ── Constellation 'I' (Clean, Pure Vertical Starlight Column) ──
  { id: 'i-stem', d: 'M 306 70 L 306 140', delay: 0.12 },
]

export function RasiInitialLoading({
  forceShow = false,
  onComplete,
  mode = 'logo-reveal',
  allowSkip = true,
  showControls = false,
}: RasiInitialLoadingProps) {
  const [activeMode, setActiveMode] = useState<LoadingMode>(mode)
  const [visible, setVisible] = useState<boolean>(true)
  // Reversed Flow:
  // Stage 1: Teks RASI (celestial letter constellation)
  // Stage 2: Grafik Saham (transforms into horizontal S-Tidur stock wave)
  // Stage 3: Logo S-Tegak (rotates 90° into official upright RASI S logo)
  // Stage 4: Steady Logo Hold (admire final official brand symbol)
  const [stage, setStage] = useState<number>(1)
  const [animTrigger, setAnimTrigger] = useState(0)
  const idSuffix = useId().replace(/:/g, '')

  const dismiss = useCallback(() => {
    setVisible(false)
    onComplete?.()
  }, [onComplete])

  const replay = useCallback(
    (newMode?: LoadingMode) => {
      if (newMode) setActiveMode(newMode)
      setStage(1)
      setAnimTrigger((v) => v + 1)
    },
    []
  )

  useEffect(() => {
    if (!visible) return

    const timers: NodeJS.Timeout[] = []

    if (activeMode === 'logo-reveal') {
      // 1. Teks RASI tampil elegan: 0.0s - 1.4s (stage = 1)
      // 2. Mengalir & bertransformasi menjadi Grafik Saham (S-Tidur): 1.4s - 2.6s (stage = 2)
      timers.push(setTimeout(() => setStage(2), 1400))
      // 3. Berputar 90° menjadi Logo Resmi RASI (S-Tegak): 2.6s - 3.8s (stage = 3)
      timers.push(setTimeout(() => setStage(3), 2600))
      // 4. Logo S resmi terkunci & ditahan sejenak: 3.8s - 4.9s (stage = 4)
      timers.push(setTimeout(() => setStage(4), 3800))
      // 5. Transisi halus ke dashboard setelah logo dinikmati
      timers.push(
        setTimeout(() => {
          if (!forceShow) {
            dismiss()
          }
        }, 4900)
      )
    } else {
      // Backward-compatible Text Collapse mode
      timers.push(setTimeout(() => setStage(2), 1000))
      timers.push(setTimeout(() => setStage(3), 2200))
      timers.push(
        setTimeout(() => {
          if (!forceShow) {
            dismiss()
          }
        }, 3600)
      )
    }

    return () => {
      timers.forEach((t) => clearTimeout(t))
    }
  }, [visible, activeMode, forceShow, dismiss, animTrigger])

  const getPointCoords = (pt: AnimationPoint) => {
    if (stage === 1) {
      // Stage 1: Stars placed at R-A-S-I letter vertices
      return pt.letter
    }
    // Stage 2, 3, 4: Stars placed at S-constellation coordinates
    // In Stage 2, the container group rotates to -90deg, turning this into the S-Tidur stock wave!
    return pt.constellation
  }

  // RASI constellation letter strokes are active only during Stage 1
  const isRasiTextActive = stage === 1
  // S-Constellation lines are active during Stage 2, 3, and 4
  const isSConstellationActive = stage >= 2

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="rasi-initial-loading-overlay"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#02050c] text-white select-none overflow-hidden"
          role="dialog"
          aria-label="Memuat aplikasi RASI"
        >
          {/* Deep Cosmic Background, Nebular Halo & Astrometry Dust */}
          <div className="pointer-events-none absolute inset-0 z-0">
            {/* Luminous Core Nebula */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_65%_at_50%_48%,rgba(14,165,233,0.16),rgba(99,102,241,0.06)_50%,transparent_75%)]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.12)_0%,rgba(99,102,241,0.06)_40%,transparent_70%)] blur-[95px]" />

            {/* Subtle celestial coordinate grid lines */}
            <div className="absolute inset-0 opacity-[0.06] bg-[linear-gradient(to_right,#38bdf8_1px,transparent_1px),linear-gradient(to_bottom,#38bdf8_1px,transparent_1px)] bg-[size:48px_48px]" />

            {/* Distant Planetarium Reticle (Faint celestial compass circle) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[380px] w-[380px] rounded-full border border-sky-400/10 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[480px] w-[480px] rounded-full border border-sky-400/[0.05] border-dashed pointer-events-none" />
          </div>

          {/* Top Controls / Header */}
          <div className="absolute top-6 right-6 z-20 flex items-center gap-3">
            {showControls && (
              <div className="flex items-center gap-1 rounded-full border border-slate-800 bg-slate-950/80 p-1 text-xs backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => replay('logo-reveal')}
                  className={`rounded-full px-3 py-1 font-medium transition-colors ${
                    activeMode === 'logo-reveal'
                      ? 'bg-sky-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  S-Tidur → S → RASI
                </button>
                <button
                  type="button"
                  onClick={() => replay()}
                  title="Putar Ulang"
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-slate-400 hover:text-white"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span className="hidden sm:inline">Ulang</span>
                </button>
              </div>
            )}

            {allowSkip && (
              <button
                type="button"
                onClick={dismiss}
                className="flex items-center gap-1 rounded-full border border-slate-800/80 bg-slate-900/60 px-3.5 py-1.5 text-xs font-semibold text-slate-300 backdrop-blur-md transition hover:border-sky-500/50 hover:bg-slate-800 hover:text-white focus-visible:outline-none"
              >
                <span>Lewati</span>
                <X className="h-3.5 w-3.5 text-slate-400" />
              </button>
            )}
          </div>

          {/* Central Stage / Celestial Canvas */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="relative h-[220px] w-[340px] sm:h-[260px] sm:w-[440px]">
              <svg
                viewBox="0 0 400 220"
                className="h-full w-full overflow-visible"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  {/* Primary Star Radiant Flare Halo */}
                  <radialGradient id={`star-glow-${idSuffix}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                    <stop offset="25%" stopColor="#38bdf8" stopOpacity="0.85" />
                    <stop offset="55%" stopColor="#0284c7" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
                  </radialGradient>

                  {/* Secondary Star Halo */}
                  <radialGradient id={`star-halo-${idSuffix}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                    <stop offset="45%" stopColor="#38bdf8" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                  </radialGradient>

                  {/* Starlight Beam Gradient (Connecting Filament) */}
                  <linearGradient
                    id={`starlight-beam-${idSuffix}`}
                    x1="60"
                    y1="70"
                    x2="340"
                    y2="140"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                    <stop offset="35%" stopColor="#e0f2fe" stopOpacity="0.98" />
                    <stop offset="70%" stopColor="#ffffff" stopOpacity="1" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.9" />
                  </linearGradient>

                  {/* Luminous Glow Filter for Constellation Beams */}
                  <filter id={`constellation-glow-${idSuffix}`} x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="2.2" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* 
                  DEEP SPACE BACKGROUND PINPOINT STARS (Subtle Astronomical Atmosphere)
                  Twinkling distant stars that place the constellation in authentic deep space.
                */}
                <g className="pointer-events-none">
                  {DEEP_SPACE_STARS.map((star, idx) => (
                    <motion.circle
                      key={`bg-star-${idx}`}
                      cx={star.x}
                      cy={star.y}
                      r={star.r}
                      fill="#e0f2fe"
                      initial={{ opacity: star.o }}
                      animate={{
                        opacity: [star.o * 0.4, star.o * 1.2, star.o * 0.4],
                      }}
                      transition={{
                        duration: 3 + (idx % 3),
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: star.delay,
                      }}
                    />
                  ))}
                </g>

                {/* 
                  S-CONSTELLATION ROTATING CONTAINER
                  In Stage 1: 0deg, displaying the upright RASI constellation text.
                  In Stage 2: rotated -90deg, displaying the horizontal "S-Tidur" stock chart wave.
                  In Stage 3+: rotates 90deg clockwise to 0deg, locking into the official upright RASI "S" logo.
                */}
                <motion.g
                  animate={{
                    rotate: stage === 2 ? -90 : 0,
                    scale: stage === 2 ? 1.08 : 1.0,
                  }}
                  transition={{
                    duration: 1.15,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  style={{
                    transformOrigin: '200px 100px',
                  }}
                >
                  {/* S-Constellation Lines (Active in Stage 1 & 2) */}
                  <motion.g
                    animate={{
                      opacity: isSConstellationActive ? 1 : 0,
                    }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                  >
                    {/* Satellite Filaments */}
                    {S_SATELLITE_LINES.map((sat, idx) => (
                      <line
                        key={`sat-line-${idx}`}
                        x1={sat.x1}
                        y1={sat.y1}
                        x2={sat.x2}
                        y2={sat.y2}
                        stroke="#38bdf8"
                        strokeWidth="0.9"
                        strokeDasharray="2 3"
                        strokeOpacity="0.4"
                      />
                    ))}

                    {/* Main S-Constellation Path */}
                    <motion.path
                      d={S_CONSTELLATION_PATH_D}
                      stroke={`url(#starlight-beam-${idSuffix})`}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter={`url(#constellation-glow-${idSuffix})`}
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{
                        pathLength: isSConstellationActive ? 1 : 0,
                        opacity: isSConstellationActive ? 0.95 : 0,
                      }}
                      transition={{
                        pathLength: { duration: 0.95, ease: [0.25, 0.1, 0.25, 1] },
                        opacity: { duration: 0.4 },
                      }}
                    />
                  </motion.g>

                  {/* 
                    CELESTIAL CONSTELLATION "R A S I" (Stage 3 & 4)
                    Constructed from pure astronomical asterisms, inter-letter bonds,
                    and celestial ties connecting starlight to starlight.
                  */}
                  <motion.g
                    animate={{
                      opacity: isRasiTextActive ? 1 : 0,
                    }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  >
                    {/* PRIMARY CONSTELLATION ASTERISM BEAMS (Straight-line starlight filaments) */}
                    {LETTER_ASTERISMS.map((asterism) => (
                      <motion.path
                        key={asterism.id}
                        d={asterism.d}
                        stroke={`url(#starlight-beam-${idSuffix})`}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter={`url(#constellation-glow-${idSuffix})`}
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{
                          pathLength: isRasiTextActive ? 1 : 0,
                          opacity: isRasiTextActive ? 0.98 : 0,
                        }}
                        transition={{
                          duration: 0.85,
                          delay: isRasiTextActive ? asterism.delay : 0,
                          ease: [0.25, 0.1, 0.25, 1],
                        }}
                      />
                    ))}
                  </motion.g>

                  {/* 
                    26 CONSTELLATION STARS & NODES
                    In Stage 1-2: Positioned as the S-constellation.
                    In Stage 3-4: Glide gracefully to form the vertices of constellation letters R, A, S, I.
                  */}
                  {ANIMATION_POINTS.map((pt, idx) => {
                    const pos = getPointCoords(pt)
                    const isCrown = pt.constellation.isPrimary
                    const isAlpha = pt.letter.isAlpha || isCrown
                    const radius = isCrown ? 5.6 : isAlpha ? 4.4 : pt.letter.r || 3.2

                    return (
                      <motion.g
                        key={pt.id}
                        animate={{
                          x: pos.x,
                          y: pos.y,
                        }}
                        transition={{
                          duration: 1.05,
                          ease: [0.25, 0.1, 0.25, 1],
                          delay: stage >= 3 ? (idx % 6) * 0.02 : 0,
                        }}
                      >
                        {/* ASTRONOMICAL DIFFRACTION SPIKES (Kilau Bintang 4-Arah) on Alpha Stars */}
                        {isAlpha && isRasiTextActive && (
                          <motion.g
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{
                              scale: [0.95, 1.1, 0.95],
                              opacity: 1,
                              rotate: [0, 2, 0],
                            }}
                            transition={{
                              scale: {
                                duration: 2.4 + (idx % 3) * 0.4,
                                repeat: Infinity,
                                ease: 'easeInOut',
                              },
                              rotate: {
                                duration: 4,
                                repeat: Infinity,
                                ease: 'easeInOut',
                              },
                            }}
                          >
                            {/* Radiant Glow Halo */}
                            <circle
                              cx={0}
                              cy={0}
                              r={radius * (isCrown ? 4.2 : 3.2)}
                              fill={`url(#star-glow-${idSuffix})`}
                            />

                            {/* 4-Point Starburst Diffraction Flare */}
                            <path
                              d={`M 0 ${-radius * (isCrown ? 3.4 : 2.5)} 
                                  Q 0 0 ${radius * (isCrown ? 3.4 : 2.5)} 0 
                                  Q 0 0 0 ${radius * (isCrown ? 3.4 : 2.5)} 
                                  Q 0 0 ${-radius * (isCrown ? 3.4 : 2.5)} 0 
                                  Z`}
                              fill="#ffffff"
                              opacity={isCrown ? '0.98' : '0.85'}
                            />
                          </motion.g>
                        )}

                        {/* Standard Focal Star Flare during Stage 3+ (Locking of Upright S Logo) */}
                        {isCrown && stage >= 3 && (
                          <motion.g
                            animate={{
                              scale: [1, 1.45, 1.2],
                              opacity: 1,
                            }}
                            transition={{
                              duration: 0.8,
                              ease: 'easeOut',
                            }}
                          >
                            <circle cx={0} cy={0} r={radius * 4.5} fill={`url(#star-glow-${idSuffix})`} />
                            <path
                              d={`M 0 ${-radius * 3.5} 
                                  Q 0 0 ${radius * 3.5} 0 
                                  Q 0 0 0 ${radius * 3.5} 
                                  Q 0 0 ${-radius * 3.5} 0 
                                  Z`}
                              fill="#ffffff"
                              opacity="0.95"
                            />
                          </motion.g>
                        )}

                        {/* Star Scintillation (Authentic Twinkling of Stars in Night Sky) */}
                        <motion.circle
                          cx={0}
                          cy={0}
                          r={radius * 1.8}
                          fill={`url(#star-halo-${idSuffix})`}
                          animate={{
                            opacity: isRasiTextActive ? [0.25, 0.55, 0.25] : 0.3,
                            scale: isRasiTextActive ? [0.92, 1.12, 0.92] : 1,
                          }}
                          transition={{
                            duration: 2.0 + (idx % 5) * 0.3,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: (idx % 6) * 0.15,
                          }}
                        />

                        {/* Solid Star Core (White Star Body) */}
                        <circle
                          cx={0}
                          cy={0}
                          r={radius}
                          fill="#ffffff"
                          stroke="#38bdf8"
                          strokeWidth={isAlpha ? 1.5 : 0.9}
                        />

                        {/* Pinpoint Core Hotspot */}
                        <circle cx={0} cy={0} r={radius * 0.45} fill="#e0f2fe" />
                      </motion.g>
                    )
                  })}
                </motion.g>
              </svg>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
