/**
 * 8-9 constellation nodes forming an abstract "S" curve
 * representing the stock price movement and star constellation of RASI.
 */
export const RASI_CONSTELLATION_NODES = [
  { id: 'n0', x: 76, y: 20, r: 3.2, isPrimary: false },
  { id: 'n1', x: 52, y: 14, r: 3.8, isPrimary: false },
  { id: 'n2', x: 26, y: 26, r: 4.2, isPrimary: false },
  { id: 'n3', x: 18, y: 48, r: 3.6, isPrimary: false },
  { id: 'n4', x: 46, y: 60, r: 5.6, isPrimary: true }, // Focal star / Breakout pivot
  { id: 'n5', x: 78, y: 72, r: 4.6, isPrimary: false },
  { id: 'n6', x: 72, y: 94, r: 3.6, isPrimary: false },
  { id: 'n7', x: 44, y: 106, r: 4.0, isPrimary: false },
  { id: 'n8', x: 22, y: 98, r: 3.2, isPrimary: false },
]

export const RASI_SATELLITE_NODES = [
  { id: 's0', x: 84, y: 34, r: 1.8, opacity: 0.65 },
  { id: 's1', x: 62, y: 48, r: 2.0, opacity: 0.75 },
  { id: 's2', x: 32, y: 88, r: 1.8, opacity: 0.65 },
]

export const RASI_PATH_D =
  'M 76 20 L 52 14 L 26 26 L 18 48 L 46 60 L 78 72 L 72 94 L 44 106 L 22 98'
