import { z } from "zod"

export const createProgramSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
  startDate: z.string().date("Invalid date format (YYYY-MM-DD)"),
  endDate: z.string().date("Invalid date format (YYYY-MM-DD)").optional(),
  budgetEstimated: z.number().positive("Budget must be positive").optional(),
  currency: z.string().length(3, "Currency must be a 3-letter code").default("EUR"),
})
export type CreateProgramInput = z.infer<typeof createProgramSchema>

export const updateProgramSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  startDate: z.string().date("Invalid date format (YYYY-MM-DD)").optional(),
  endDate: z.string().date("Invalid date format (YYYY-MM-DD)").optional(),
  budgetEstimated: z.number().positive("Budget must be positive").optional(),
  currency: z.string().length(3).optional(),
})
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>
