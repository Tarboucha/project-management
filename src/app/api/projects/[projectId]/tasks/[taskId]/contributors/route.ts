import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
  HTTP_STATUS,
} from "@/lib/utils/api-response"
import { withAdminOrProjectRole } from "@/lib/utils/api-route-helper"
import { z } from "zod"
import { auditLog } from "@/lib/utils/audit"

type Params = { projectId: string; taskId: string }

const addContributorSchema = z.object({
  actorId: z.string().uuid("Invalid actor ID"),
})

export const GET = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (_actor, _request: NextRequest, params) => {
  const { projectId, taskId } = params!

  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task || task.deletedAt || task.projectId !== projectId) {
    return ApiErrors.notFound("Task")
  }

  const contributors = await prisma.taskContributor.findMany({
    where: { taskId },
    include: {
      actor: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
    orderBy: { assignedAt: "asc" },
  })

  return successResponse(contributors)
})

export const POST = withAdminOrProjectRole<Params>("MANAGER", async (currentActor, request: NextRequest, params) => {
  const { projectId, taskId } = params!

  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task || task.deletedAt || task.projectId !== projectId) {
    return ApiErrors.notFound("Task")
  }

  const body = await request.json()
  const validation = addContributorSchema.safeParse(body)

  if (!validation.success) {
    const msg = validation.error.issues[0].message
    return ApiErrors.validationError(msg)
  }

  const { actorId } = validation.data

  // Check actor exists
  const targetActor = await prisma.actor.findUnique({ where: { id: actorId } })
  if (!targetActor || targetActor.deletedAt) {
    return ApiErrors.notFound("Actor")
  }

  // Check actor is a project member
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_actorId: { projectId, actorId } },
  })
  if (!membership) {
    return ApiErrors.validationError("Actor must be a project member to be added as a contributor")
  }

  // Check not already a contributor
  const existing = await prisma.taskContributor.findUnique({
    where: { taskId_actorId: { taskId, actorId } },
  })
  if (existing) {
    return ApiErrors.conflict("Actor is already a contributor on this task")
  }

  const contributor = await prisma.taskContributor.create({
    data: { taskId, actorId },
    include: {
      actor: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  })

  await auditLog({ entityType: "TaskContributor", entityId: actorId, action: "CREATE", actorId: currentActor.id, newData: contributor })

  return successResponse(contributor, "Contributor added", HTTP_STATUS.CREATED)
})

export async function PUT() { return handleUnsupportedMethod(["GET", "POST"]) }
export async function DELETE() { return handleUnsupportedMethod(["GET", "POST"]) }
export async function PATCH() { return handleUnsupportedMethod(["GET", "POST"]) }
