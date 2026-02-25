import { z } from "zod"

export const createMilestoneSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
  dueDate: z.string().date("Invalid date format (YYYY-MM-DD)"),
})
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>

export const updateMilestoneSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  dueDate: z.string().date("Invalid date format (YYYY-MM-DD)").optional(),
})
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>
