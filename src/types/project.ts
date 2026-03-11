import type { EntityState, NamedEntity, ActorSummary, ActorWithEmail, ProjectRole } from "./shared"

export interface MemberEntry {
  role: ProjectRole
  actorId: string
  actor: ActorWithEmail
}

export interface ProjectListItem {
  id: string
  name: string
  state: EntityState
  progress: number
  startDate: string
  program: NamedEntity
  _count: { members: number; tasks: number }
}

export interface ProjectDetail {
  id: string
  version: number
  name: string
  objective?: string | null
  state: EntityState
  progress: number
  startDate: string
  endDate?: string | null
  budgetEstimated?: string | null
  createdAt: string
  program: NamedEntity
  activity?: NamedEntity | null
  theme?: NamedEntity | null
  category?: NamedEntity | null
  createdBy: ActorSummary
  members: MemberEntry[]
  _count: { tasks: number }
}
