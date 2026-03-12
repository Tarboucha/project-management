import { prisma } from "@/lib/prisma/client"

/**
 * FK fields that should be resolved to human-readable names.
 * Lookup tables resolve to `name`, actors resolve to `firstName lastName`.
 */
const LOOKUP_FIELDS = ["theme_id", "category_id", "activity_id", "deliverable_id"] as const
const ACTOR_FIELDS = ["owner_id", "responsible_id", "uploaded_by_id"] as const

/**
 * Resolves FK UUIDs in audit entry data to human-readable names.
 * Mutates entries in-place, adding e.g. `theme_id` → `theme`, `owner_id` → `owner`.
 * Also enriches `changedFields` so UPDATE diffs display names instead of UUIDs.
 */
export async function enrichAuditEntries(
  entries: Array<{ oldData: unknown; newData: unknown; changedFields?: unknown }>,
): Promise<void> {
  const ids = {
    theme: new Set<string>(),
    category: new Set<string>(),
    activity: new Set<string>(),
    deliverable: new Set<string>(),
    actor: new Set<string>(),
  }

  for (const entry of entries) {
    for (const data of [entry.oldData, entry.newData, entry.changedFields]) {
      if (!data || typeof data !== "object") continue
      const d = data as Record<string, unknown>
      if (typeof d.theme_id === "string") ids.theme.add(d.theme_id)
      if (typeof d.category_id === "string") ids.category.add(d.category_id)
      if (typeof d.activity_id === "string") ids.activity.add(d.activity_id)
      if (typeof d.deliverable_id === "string") ids.deliverable.add(d.deliverable_id)
      for (const field of ACTOR_FIELDS) {
        if (typeof d[field] === "string") ids.actor.add(d[field] as string)
      }
    }
  }

  const hasLookups = ids.theme.size > 0 || ids.category.size > 0 || ids.activity.size > 0 || ids.deliverable.size > 0
  const hasActors = ids.actor.size > 0
  if (!hasLookups && !hasActors) return

  const [themes, categories, activities, deliverables, actors] = await Promise.all([
    ids.theme.size > 0
      ? prisma.theme.findMany({ where: { id: { in: [...ids.theme] } }, select: { id: true, name: true } })
      : [],
    ids.category.size > 0
      ? prisma.category.findMany({ where: { id: { in: [...ids.category] } }, select: { id: true, name: true } })
      : [],
    ids.activity.size > 0
      ? prisma.activity.findMany({ where: { id: { in: [...ids.activity] } }, select: { id: true, name: true } })
      : [],
    ids.deliverable.size > 0
      ? prisma.deliverable.findMany({ where: { id: { in: [...ids.deliverable] } }, select: { id: true, name: true } })
      : [],
    ids.actor.size > 0
      ? prisma.actor.findMany({ where: { id: { in: [...ids.actor] } }, select: { id: true, firstName: true, lastName: true } })
      : [],
  ])

  const nameMap = new Map<string, string>()
  for (const row of [...themes, ...categories, ...activities, ...deliverables]) {
    nameMap.set(row.id, row.name)
  }
  for (const row of actors) {
    nameMap.set(row.id, `${row.firstName} ${row.lastName}`)
  }

  for (const entry of entries) {
    for (const data of [entry.oldData, entry.newData, entry.changedFields]) {
      if (!data || typeof data !== "object") continue
      const d = data as Record<string, unknown>
      for (const field of LOOKUP_FIELDS) {
        const id = d[field]
        if (typeof id === "string" && nameMap.has(id)) {
          const nameField = field.replace(/_id$/, "")
          d[nameField] = nameMap.get(id)
        }
      }
      for (const field of ACTOR_FIELDS) {
        const id = d[field]
        if (typeof id === "string" && nameMap.has(id)) {
          const nameField = field.replace(/_id$/, "")
          d[nameField] = nameMap.get(id)
        }
      }
    }
  }
}
