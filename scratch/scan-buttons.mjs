import fs from 'fs'
import path from 'path'

function scanDir(dir) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        scanDir(fullPath)
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8')
      const lines = content.split(/\r?\n/)
      lines.forEach((line, idx) => {
        if (
          line.includes('text-white') ||
          line.includes('bg-white') ||
          line.includes('bg-[var(--rasi-primary)]')
        ) {
          console.log(`${fullPath}:${idx + 1}: ${line.trim()}`)
        }
      })
    }
  }
}

scanDir('components')
scanDir('app')
