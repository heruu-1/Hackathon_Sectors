import fs from 'fs'

if (fs.existsSync('.env.local')) {
  const content = fs.readFileSync('.env.local', 'utf8')
  const match = content.match(/DATABASE_URL=['"]?postgres(?:ql)?:\/\/[^@]+@([^:\/]+)/)
  if (match) console.log('DB Host:', match[1])
}
