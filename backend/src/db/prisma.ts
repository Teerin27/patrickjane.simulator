import { PrismaPg } from '@prisma/adapter-pg'
import { env } from '../config/env.js'
import { PrismaClient } from '../generated/prisma/client.js'

// Prisma 7 reaches the database through a driver adapter (node-postgres here).
// The adapter owns the connection pool; one client per process.
export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) })
