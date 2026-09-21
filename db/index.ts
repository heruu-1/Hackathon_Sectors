import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema.ts'

let client: postgres.Sql | null = null
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (dbInstance) return dbInstance

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL belum diisi pada konfigurasi server.')
  }

  client = postgres(connectionString, {
    prepare: false,
    connect_timeout: 5,
    connection: { statement_timeout: 5000 },
  })

  dbInstance = drizzle(client, { schema })
  return dbInstance
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    const instance = getDb()
    return (instance as unknown as Record<string | symbol, unknown>)[prop]
  },
})
