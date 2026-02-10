import { z } from 'zod'

export const itemIdSchema = z.object({
  id: z.string().uuid(),
})

export const createItemSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
})
