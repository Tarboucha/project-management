import { prisma } from "@/lib/prisma/client"
import type { Actor } from "@/generated/prisma/client"

/**
 * Wraps Prisma calls in a transaction with RLS session variables.
 * Sets app.actor_id and app.system_role so PostgreSQL RLS policies
 * can identify who is making the request.
 *
 * Usage:
 *   const tasks = await withRLS(actor, (db) =>
 *     db.task.findMany({ where: { projectId } })
 *   )
 */
export async function withRLS<T>(
  actor: Actor,
  fn: (tx: typeof prisma) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.actor_id', $1, true)`,
      actor.id,
    )
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.system_role', $1, true)`,
      actor.systemRole,
    )
    return fn(tx as typeof prisma)
  })
}
