import type { ActorSummary } from "./shared"

export type TodoStatus = "ACTIVE" | "INACTIVE"

export interface TodoItem {
  id: string
  version: number
  todoOrder: number
  action: string
  status: TodoStatus
  deliveryDate?: string | null
  responsibleId?: string | null
  responsible?: ActorSummary | null
  comments?: string | null
  createdById: string
  createdBy: ActorSummary
  createdAt: string
}
