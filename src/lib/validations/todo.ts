import { z } from "zod"

export const todoStatusEnum = z.enum(["ACTIVE", "INACTIVE"])

export const createTodoSchema = z.object({
  action: z.string().min(1, "Action is required"),
  todoOrder: z.number().int().min(0).default(0),
  status: todoStatusEnum.default("ACTIVE"),
  deliveryDate: z.string().date("Invalid date format (YYYY-MM-DD)").optional(),
  responsibleId: z.string().uuid("Invalid responsible ID").nullable().optional(),
  comments: z.string().optional(),
})
export type CreateTodoInput = z.infer<typeof createTodoSchema>

export const updateTodoSchema = z.object({
  action: z.string().min(1).optional(),
  todoOrder: z.number().int().min(0).optional(),
  status: todoStatusEnum.optional(),
  deliveryDate: z.string().date("Invalid date format (YYYY-MM-DD)").nullable().optional(),
  responsibleId: z.string().uuid("Invalid responsible ID").nullable().optional(),
  comments: z.string().nullable().optional(),
})
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>
