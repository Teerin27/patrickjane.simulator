import { PrismaClient } from '@prisma/client'

// One client per process; it manages its own connection pool
export const prisma = new PrismaClient()
