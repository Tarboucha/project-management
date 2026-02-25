import { z } from "zod"

export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  objective: z.string().optional(),
  programId: z.string().uuid("Invalid program ID"),
  startDate: z.string().date("Invalid date format (YYYY-MM-DD)"),
  endDate: z.string().date("Invalid date format (YYYY-MM-DD)").optional(),
  budgetEstimated: z.number().positive("Budget must be positive").optional(),
})
export type CreateProjectInput = z.infer<typeof createProjectSchema>

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  objective: z.string().optional(),
  startDate: z.string().date("Invalid date format (YYYY-MM-DD)").optional(),
  endDate: z.string().date("Invalid date format (YYYY-MM-DD)").optional(),
  budgetEstimated: z.number().positive("Budget must be positive").optional(),
})
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>

export const addProjectMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["DIRECTOR", "MANAGER", "CONTRIBUTOR"]),
})
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>

export const updateProjectMemberSchema = z.object({
  role: z.enum(["DIRECTOR", "MANAGER", "CONTRIBUTOR"]),
})
export type UpdateProjectMemberInput = z.infer<typeof updateProjectMemberSchema>
