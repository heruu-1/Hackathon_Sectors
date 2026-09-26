import { ImageResponse } from 'next/og'

export const size = {
  width: 120,
  height: 120,
}

export const contentType = 'image/png'

const RASI_CONSTELLATION_NODES = [
  { id: 'n0', x: 76, y: 20, r: 3.2, isPrimary: false },
  { id: 'n1', x: 52, y: 14, r: 3.8, isPrimary: false },
  { id: 'n2', x: 26, y: 26, r: 4.2, isPrimary: false },
  { id: 'n3', x: 18, y: 48, r: 3.6, isPrimary: false },
  { id: 'n4', x: 46, y: 60, r: 5.6, isPrimary: true },
  { id: 'n5', x: 78, y: 72, r: 4.6, isPrimary: false },
  { id: 'n6', x: 72, y: 94, r: 3.6, isPrimary: false },
  { id: 'n7', x: 44, y: 106, r: 4.0, isPrimary: false },
  { id: 'n8', x: 22, y: 98, r: 3.2, isPrimary: false },
]

const RASI_SATELLITE_NODES = [
  { id: 's0', x: 84, y: 34, r: 1.8, opacity: 0.65 },
  { id: 's1', x: 62, y: 48, r: 2.0, opacity: 0.75 },
  { id: 's2', x: 32, y: 88, r: 1.8, opacity: 0.65 },
]

const RASI_PATH_D = 'M 76 20 L 52 14 L 26 26 L 18 48 L 46 60 L 78 72 L 72 94 L 44 106 L 22 98'

export default function Icon() {
  const haloColor = '#38bdf8'
  const starFill = '#ffffff'
  const accentFill = '#38bdf8'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
        }}
      >
        <svg
          viewBox="-10 0 120 120"
          width="120"
          height="120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Main Stock-Chart S Constellation Line */}
          <path
            d={RASI_PATH_D}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Satellite Micro Data Points */}
          {RASI_SATELLITE_NODES.map((s) => (
            <circle
              key={s.id}
              cx={s.x}
              cy={s.y}
              r={s.r * 1.5}
              fill={accentFill}
              fillOpacity={s.opacity}
            />
          ))}

          {/* Constellation Nodes (Data Points) */}
          {RASI_CONSTELLATION_NODES.map((node) => {
            if (node.isPrimary) {
              return (
                <g key={node.id}>
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
      </div>
    ),
    {
      ...size,
    }
  )
}
