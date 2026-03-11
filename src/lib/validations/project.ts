import { z } from "zod"

export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  projectCode: z.string().max(255).optional(),
  objective: z.string().optional(),
  programId: z.string().uuid("Invalid program ID"),
  activityId: z.string().uuid("Invalid activity ID").optional(),
  themeId: z.string().uuid("Invalid theme ID").optional(),
  categoryId: z.string().uuid("Invalid category ID").optional(),
  startDate: z.string().date("Invalid date format (YYYY-MM-DD)"),
  endDate: z.string().date("Invalid date format (YYYY-MM-DD)").optional(),
  budgetEstimated: z.number().positive("Budget must be positive").optional(),
})
export type CreateProjectInput = z.infer<typeof createProjectSchema>

export const updateProjectSchema = z.object({
  version: z.number().int().positive(),
  name: z.string().min(1).max(255).optional(),
  projectCode: z.string().max(255).nullable().optional(),
  objective: z.string().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  activityId: z.string().uuid("Invalid activity ID").nullable().optional(),
  themeId: z.string().uuid("Invalid theme ID").nullable().optional(),
  categoryId: z.string().uuid("Invalid category ID").nullable().optional(),
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
