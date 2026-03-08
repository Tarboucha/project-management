export type EntityState = "ACTIVE" | "ENDED"
export type ProjectRole = "DIRECTOR" | "MANAGER" | "CONTRIBUTOR"
export type TaskPriority = "LOW" | "NORMAL" | "MEDIUM" | "HIGH" | "URGENT"

export interface NamedEntity { id: string; name: string }
export interface ActorSummary { id: string; firstName: string; lastName: string }
export interface ActorWithEmail extends ActorSummary { email: string }
