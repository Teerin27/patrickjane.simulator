import { z } from 'zod'

// Usernames and emails are stored lowercase, so the database's unique index is case-insensitive.
// Normalizing here (not in the route) keeps create and update in agreement.
const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, '3-20 characters: letters, digits and underscores')

const email = z.string().trim().toLowerCase().max(254).pipe(z.email())

// Passwords are taken exactly as typed (no trim, no case change). The upper bound stops someone
// from making the server hash megabytes of input.
const password = z.string().min(8, 'At least 8 characters').max(128)

export const createPlayerBody = z.object({ username, email, password })

export const updatePlayerBody = z
  .object({
    username: username.optional(),
    email: email.optional(),
    password: password.optional(),
    // proves the person at the keyboard knows the password, not just that they hold a token
    currentPassword: z.string().min(1).max(128).optional(),
  })
  .refine(
    (body) => body.username !== undefined || body.email !== undefined || body.password !== undefined,
    'Send at least one field to update',
  )
  .refine((body) => body.password === undefined || body.currentPassword !== undefined, {
    message: 'currentPassword is required to change the password',
    path: ['currentPassword'],
  })

// Login does not re-check the username format: a wrong-looking name is just "wrong credentials".
export const loginBody = z.object({
  username: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(128),
})

export const listPlayersQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export type CreatePlayerInput = z.infer<typeof createPlayerBody>
export type UpdatePlayerInput = z.infer<typeof updatePlayerBody>
export type LoginInput = z.infer<typeof loginBody>
export type ListPlayersQuery = z.infer<typeof listPlayersQuery>
