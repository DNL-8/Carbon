import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './web/server/db/schema.ts',
  out: './web/drizzle',
  dbCredentials: { url: process.env.DATABASE_URL_DIRECT ?? '' },
})
