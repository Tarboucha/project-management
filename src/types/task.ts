import type { EntityState, TaskPriority, ActorSummary, ActorWithEmail } from "./shared"

export interface TaskListItem {
  id: string
  version: number
  objective: string
  state: EntityState
  priority: TaskPriority
  progress: number
  taskOrder: number
  startDate: string
  endDate?: string | null
  details?: string | null
  budgetEstimated?: number | string | null
  owner?: { id: string; firstName: string; lastName: string } | null
  _count: { deliverables: number; timeEntries: number }
}

export interface TaskDetail {
  id: string
  version: number
  objective: string
  details?: string | null
  state: EntityState
  priority: TaskPriority
  progress: number
  taskOrder: number
  startDate: string
  endDate?: string | null
  budgetEstimated?: number | string | null
  ownerId?: string | null
  createdBy: ActorSummary
  owner?: ActorWithEmail | null
  _count: { deliverables: number; timeEntries: number }
}
