import { z } from "zod"

export const createDeliverableSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  type: z.string().max(100).optional(),
})

export const updateDeliverableSchema = z.object({
  version: z.number().int().positive(),
  name: z.string().min(1).max(255).optional(),
  type: z.string().max(100).nullable().optional(),
})
