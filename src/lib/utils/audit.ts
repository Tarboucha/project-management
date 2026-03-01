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

/**
 * Map of lookup FK fields to their Prisma model for resolution.
 */
const LOOKUP_FIELDS = ["themeId", "categoryId", "activityId"] as const

/**
 * Resolves lookup FK UUIDs in audit entry data to human-readable names.
 * Mutates entries in-place, adding e.g. `theme: "Name"` alongside `themeId`.
 */
export async function enrichAuditEntries(
  entries: Array<{ oldData: unknown; newData: unknown }>,
): Promise<void> {
  const ids = { theme: new Set<string>(), category: new Set<string>(), activity: new Set<string>() }

  for (const entry of entries) {
    for (const data of [entry.oldData, entry.newData]) {
      if (!data || typeof data !== "object") continue
      const d = data as Record<string, unknown>
      if (typeof d.themeId === "string") ids.theme.add(d.themeId)
      if (typeof d.categoryId === "string") ids.category.add(d.categoryId)
      if (typeof d.activityId === "string") ids.activity.add(d.activityId)
    }
  }

  const hasAny = ids.theme.size > 0 || ids.category.size > 0 || ids.activity.size > 0
  if (!hasAny) return

  const [themes, categories, activities] = await Promise.all([
    ids.theme.size > 0
      ? prisma.theme.findMany({ where: { id: { in: [...ids.theme] } }, select: { id: true, name: true } })
      : [],
    ids.category.size > 0
      ? prisma.category.findMany({ where: { id: { in: [...ids.category] } }, select: { id: true, name: true } })
      : [],
    ids.activity.size > 0
      ? prisma.activity.findMany({ where: { id: { in: [...ids.activity] } }, select: { id: true, name: true } })
      : [],
  ])

  const nameMap = new Map<string, string>()
  for (const row of [...themes, ...categories, ...activities]) {
    nameMap.set(row.id, row.name)
  }

  for (const entry of entries) {
    for (const data of [entry.oldData, entry.newData]) {
      if (!data || typeof data !== "object") continue
      const d = data as Record<string, unknown>
      for (const field of LOOKUP_FIELDS) {
        const id = d[field]
        if (typeof id === "string" && nameMap.has(id)) {
          // Add resolved name field (e.g. themeId → theme)
          const nameField = field.replace(/Id$/, "")
          d[nameField] = nameMap.get(id)
        }
      }
    }
  }
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
