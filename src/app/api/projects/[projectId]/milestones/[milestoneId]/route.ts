import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  successResponse,
  handleUnsupportedMethod,
  parseZodError,
  ApiErrors,
} from "@/lib/utils/api-response"
import { withAdminOrProjectRole } from "@/lib/utils/api-route-helper"
import { updateMilestoneSchema } from "@/lib/validations/milestone"
import { auditLog } from "@/lib/utils/audit"

type Params = { projectId: string; milestoneId: string }

export const GET = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (_actor, _request: NextRequest, params) => {
  const { projectId, milestoneId } = params!

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      tasks: {
        where: { deletedAt: null },
        orderBy: { taskOrder: "asc" },
        select: { id: true, objective: true, state: true, progress: true, priority: true },
      },
    },
  })

  if (!milestone || milestone.deletedAt || milestone.projectId !== projectId) {
    return ApiErrors.notFound("Milestone")
  }

  return successResponse(milestone)
})

export const PATCH = withAdminOrProjectRole<Params>("MANAGER", async (actor, request: NextRequest, params) => {
  const { projectId, milestoneId } = params!

  const existing = await prisma.milestone.findUnique({ where: { id: milestoneId } })
  if (!existing || existing.deletedAt || existing.projectId !== projectId) {
    return ApiErrors.notFound("Milestone")
  }

  const body = await request.json()
  const validation = updateMilestoneSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  const updateData: Record<string, unknown> = {
    ...validation.data,
    version: { increment: 1 },
    modifiedAt: new Date(),
  }

  if (validation.data.dueDate) {
    updateData.dueDate = new Date(validation.data.dueDate)
  }

  const milestone = await prisma.milestone.update({
    where: { id: milestoneId },
    data: updateData,
  })

  await auditLog({ entityType: "Milestone", entityId: milestoneId, action: "UPDATE", actorId: actor.id, oldData: existing, newData: milestone, version: milestone.version })

  return successResponse(milestone, "Milestone updated")
})

export const DELETE = withAdminOrProjectRole<Params>("MANAGER", async (actor, _request: NextRequest, params) => {
  const { projectId, milestoneId } = params!

  const existing = await prisma.milestone.findUnique({ where: { id: milestoneId } })
  if (!existing || existing.deletedAt || existing.projectId !== projectId) {
    return ApiErrors.notFound("Milestone")
  }

  const milestone = await prisma.milestone.update({
    where: { id: milestoneId },
    data: { deletedAt: new Date(), modifiedAt: new Date() },
  })

  await auditLog({ entityType: "Milestone", entityId: milestoneId, action: "DELETE", actorId: actor.id, oldData: existing })

  return successResponse(milestone, "Milestone deleted")
})

export async function PUT() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
export async function POST() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
