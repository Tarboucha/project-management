import type { ActorSummary } from "./shared"

export interface AuditEntry {
  id: string
  tableName: string
  recordId: string
  action: "CREATE" | "UPDATE" | "END" | "DELETE"
  projectId?: string | null
  taskId?: string | null
  oldData: Record<string, unknown> | null
  newData: Record<string, unknown> | null
  changedFields: Record<string, unknown> | null
  actor: ActorSummary | null
  createdAt: string
}
