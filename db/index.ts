import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema.ts'

const connectionString = process.env.DATABASE_URL!

const client = postgres(connectionString, {
  prepare: false,
  connect_timeout: 5,
  connection: { statement_timeout: 5000 },
})

export const db = drizzle(client, { schema })
