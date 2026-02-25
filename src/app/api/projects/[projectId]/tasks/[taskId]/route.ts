import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  successResponse,
  handleUnsupportedMethod,
  parseZodError,
  ApiErrors,
} from "@/lib/utils/api-response"
import { withAdminOrProjectRole } from "@/lib/utils/api-route-helper"
import { updateTaskSchema } from "@/lib/validations/task"
import { auditLog } from "@/lib/utils/audit"

type Params = { projectId: string; taskId: string }

export const GET = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (_actor, _request: NextRequest, params) => {
  const { projectId, taskId } = params!

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      contributors: {
        include: { actor: { select: { id: true, firstName: true, lastName: true, email: true } } },
      },
      milestone: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      _count: {
        select: {
          deliverables: { where: { deletedAt: null } },
          timeEntries: { where: { deletedAt: null } },
        },
      },
    },
  })

  if (!task || task.deletedAt || task.projectId !== projectId) {
    return ApiErrors.notFound("Task")
  }

  return successResponse(task)
})

export const PATCH = withAdminOrProjectRole<Params>("MANAGER", async (actor, request: NextRequest, params) => {
  const { projectId, taskId } = params!

  const existing = await prisma.task.findUnique({ where: { id: taskId } })
  if (!existing || existing.deletedAt || existing.projectId !== projectId) {
    return ApiErrors.notFound("Task")
  }

  const body = await request.json()
  const validation = updateTaskSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  // Verify milestone belongs to project if provided
  if (validation.data.milestoneId) {
    const milestone = await prisma.milestone.findUnique({
      where: { id: validation.data.milestoneId },
    })
    if (!milestone || milestone.deletedAt || milestone.projectId !== projectId) {
      return ApiErrors.notFound("Milestone")
    }
  }

  const updateData: Record<string, unknown> = {
    ...validation.data,
    version: { increment: 1 },
    modifiedAt: new Date(),
  }

  if (validation.data.startDate) {
    updateData.startDate = new Date(validation.data.startDate)
  }
  if (validation.data.endDate) {
    updateData.endDate = new Date(validation.data.endDate)
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: updateData,
  })

  await auditLog({ entityType: "Task", entityId: taskId, action: "UPDATE", actorId: actor.id, oldData: existing, newData: task, version: task.version })

  return successResponse(task, "Task updated")
})

export const DELETE = withAdminOrProjectRole<Params>("MANAGER", async (actor, _request: NextRequest, params) => {
  const { projectId, taskId } = params!

  const existing = await prisma.task.findUnique({ where: { id: taskId } })
  if (!existing || existing.deletedAt || existing.projectId !== projectId) {
    return ApiErrors.notFound("Task")
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: { deletedAt: new Date(), modifiedAt: new Date() },
  })

  await auditLog({ entityType: "Task", entityId: taskId, action: "DELETE", actorId: actor.id, oldData: existing })

  return successResponse(task, "Task deleted")
})

export async function PUT() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
export async function POST() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
