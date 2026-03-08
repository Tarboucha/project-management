import type { EntityState, ActorSummary } from "./shared"

export interface Program {
  id: string
  name: string
  description?: string | null
  state: EntityState
  startDate: string
  endDate?: string | null
  budgetEstimated?: string | null
  currency?: string | null
  createdAt: string
  createdBy: ActorSummary
  _count: { projects: number }
}
