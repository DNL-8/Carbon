import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../db/schema'

let database: ReturnType<typeof connect> | undefined

function connect(connectionString: string) {
  return drizzle(new Pool({ connectionString, max: 5, connectionTimeoutMillis: 5000 }), { schema })
}

export function getDatabase() {
  if (!process.env.DATABASE_URL) {
    throw createError({ statusCode: 503, statusMessage: 'Banco de dados indisponivel' })
  }
  return database ??= connect(process.env.DATABASE_URL)
}
