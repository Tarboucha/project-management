import { z } from "zod"

export const createTaskSchema = z.object({
  objective: z.string().min(1, "Objective is required").max(255),
  details: z.string().optional(),
  ownerId: z.string().uuid("Invalid owner ID").nullable().optional(),
  priority: z.enum(["LOW", "NORMAL", "MEDIUM", "HIGH", "URGENT"]).default("NORMAL"),
  taskOrder: z.number().int("Order must be a whole number").min(1, "Order is required"),
  startDate: z.string().date("Invalid date format (YYYY-MM-DD)"),
  endDate: z.string().date("Invalid date format (YYYY-MM-DD)").optional(),
  budgetEstimated: z.number().positive("Budget must be positive").optional(),
})
export type CreateTaskInput = z.infer<typeof createTaskSchema>

export const updateTaskSchema = z.object({
  version: z.number().int().positive(),
  objective: z.string().min(1).max(255).optional(),
  details: z.string().optional(),
  ownerId: z.string().uuid("Invalid owner ID").nullable().optional(),
  priority: z.enum(["LOW", "NORMAL", "MEDIUM", "HIGH", "URGENT"]).optional(),
  taskOrder: z.number().int("Order must be a whole number").min(1).optional(),
  state: z.enum(["ACTIVE", "WAITING", "ENDED", "CANCELED"]).optional(),
  progress: z.number().min(0).max(100).optional(),
  startDate: z.string().date("Invalid date format (YYYY-MM-DD)").optional(),
  endDate: z.string().date("Invalid date format (YYYY-MM-DD)").optional(),
  budgetEstimated: z.number().positive("Budget must be positive").optional(),
})
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
