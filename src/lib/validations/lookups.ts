import { z } from "zod"

export const createLookupSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
})
export type CreateLookupInput = z.infer<typeof createLookupSchema>

export const updateLookupSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
})
export type UpdateLookupInput = z.infer<typeof updateLookupSchema>
