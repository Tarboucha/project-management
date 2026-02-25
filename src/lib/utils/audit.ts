import { prisma } from "@/lib/prisma"
import type { AuditAction, Prisma } from "@/generated/prisma/client"

interface AuditEntry {
  entityType: string
  entityId: string
  action: AuditAction
  actorId: string
  oldData?: unknown
  newData?: unknown
  version?: number
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

/**
 * For UPDATE actions, computes the delta: returns only the keys in `newObj`
 * whose values differ from `oldObj`. Returns null if nothing changed.
 */
function changedFields(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
): Record<string, unknown> | null {
  const diff: Record<string, unknown> = {}
  for (const key of Object.keys(newObj)) {
    if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
      diff[key] = newObj[key]
    }
  }
  return Object.keys(diff).length > 0 ? diff : null
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    let oldData: Prisma.InputJsonValue | undefined
    let newData: Prisma.InputJsonValue | undefined

    if (entry.action === "UPDATE" && entry.oldData != null && entry.newData != null) {
      // oldData = full snapshot, newData = only changed fields
      const delta = changedFields(
        entry.oldData as Record<string, unknown>,
        entry.newData as Record<string, unknown>,
      )
      if (!delta) return // nothing actually changed
      oldData = toJson(entry.oldData)
      newData = toJson(delta)
    } else {
      oldData = entry.oldData != null ? toJson(entry.oldData) : undefined
      newData = entry.newData != null ? toJson(entry.newData) : undefined
    }

    await prisma.auditLog.create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        actorId: entry.actorId,
        oldData,
        newData,
        version: entry.version,
      },
    })
  } catch (err) {
    console.error("[audit] Failed to write audit log:", entry.entityType, entry.entityId, entry.action, err)
  }
}
