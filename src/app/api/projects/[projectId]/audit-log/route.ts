import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  handleUnsupportedMethod,
  parseCursorPagination,
  cursorPaginatedResponse,
  parseFilters,
  ApiErrors,
} from "@/lib/utils/api-response"
import { withAdminOrProjectRole } from "@/lib/utils/api-route-helper"
import { enrichAuditEntries } from "@/lib/utils/audit"
import type { Prisma, AuditAction } from "@/generated/prisma/client"

type Params = { projectId: string }

export const GET = withAdminOrProjectRole<Params>("MANAGER", async (_actor, request: NextRequest, params) => {
  const { projectId } = params!

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project || project.deletedAt) {
    return ApiErrors.notFound("Project")
  }

  const searchParams = request.nextUrl.searchParams
  const pagination = parseCursorPagination(searchParams)
  const filters = parseFilters(searchParams, ["entityType", "entityId", "action"])

  let where: Prisma.AuditLogWhereInput

  if (filters.entityId) {
    // Single entity history mode (used by History dialog)
    where = {
      entityId: filters.entityId,
      ...(filters.entityType && { entityType: filters.entityType }),
      ...(filters.action && { action: filters.action as AuditAction }),
    }
  } else {
    // Full project scope — gather all child entity IDs
    const [tasks, milestones, members, contributors] = await Promise.all([
      prisma.task.findMany({ where: { projectId }, select: { id: true } }),
      prisma.milestone.findMany({ where: { projectId }, select: { id: true } }),
      prisma.projectMember.findMany({ where: { projectId }, select: { actorId: true } }),
      prisma.taskContributor.findMany({
        where: { task: { projectId } },
        select: { actorId: true },
      }),
    ])

    const taskIds = tasks.map((t) => t.id)
    const milestoneIds = milestones.map((m) => m.id)
    const memberActorIds = members.map((m) => m.actorId)
    const contributorActorIds = contributors.map((c) => c.actorId)

    const orConditions: Prisma.AuditLogWhereInput[] = [
      { entityType: "Project", entityId: projectId },
    ]
    if (taskIds.length > 0) orConditions.push({ entityType: "Task", entityId: { in: taskIds } })
    if (milestoneIds.length > 0) orConditions.push({ entityType: "Milestone", entityId: { in: milestoneIds } })
    if (memberActorIds.length > 0) orConditions.push({ entityType: "ProjectMember", entityId: { in: memberActorIds } })
    if (contributorActorIds.length > 0) orConditions.push({ entityType: "TaskContributor", entityId: { in: contributorActorIds } })

    where = {
      OR: orConditions,
      ...(filters.entityType && { entityType: filters.entityType }),
      ...(filters.action && { action: filters.action as AuditAction }),
    }
  }

  const logs = await prisma.auditLog.findMany({
    where,
    take: pagination.limit + 1,
    ...(pagination.cursor && {
      cursor: { id: pagination.cursor },
      skip: 1,
    }),
    orderBy: { createdAt: "desc" },
    include: {
      actor: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  })

  await enrichAuditEntries(logs)

  return cursorPaginatedResponse(logs, pagination)
})

export async function POST() { return handleUnsupportedMethod(["GET"]) }
export async function PUT() { return handleUnsupportedMethod(["GET"]) }
export async function DELETE() { return handleUnsupportedMethod(["GET"]) }
export async function PATCH() { return handleUnsupportedMethod(["GET"]) }
