// Prisma 7 no longer reads .env or the datasource URL from schema.prisma:
// the CLI (generate, migrate, studio) takes its settings from this file.
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
})
