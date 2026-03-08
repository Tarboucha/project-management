import { NextRequest } from "next/server"
import { withRLS } from "@/lib/prisma/rls"
import {
  successResponse,
  handleUnsupportedMethod,
  parseZodError,
  ApiErrors,
} from "@/lib/utils/api-response"
import { withAdminOrProjectRole } from "@/lib/utils/api-route-helper"
import { updateTaskSchema } from "@/lib/validations/task"
type Params = { projectId: string; taskId: string }

export const GET = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (actor, _request: NextRequest, params) => {
  const { projectId, taskId } = params!

  return withRLS(actor, async (db) => {
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
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
})

export const PATCH = withAdminOrProjectRole<Params>("MANAGER", async (actor, request: NextRequest, params) => {
  const { projectId, taskId } = params!

  const body = await request.json()
  const validation = updateTaskSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  const updateData: Record<string, unknown> = {
    ...validation.data,
    version: { increment: 1 },
  }

  if (validation.data.startDate) {
    updateData.startDate = new Date(validation.data.startDate)
  }
  if (validation.data.endDate) {
    updateData.endDate = new Date(validation.data.endDate)
  }

  const result = await withRLS(actor, async (db) => {
    const existing = await db.task.findUnique({ where: { id: taskId } })
    if (!existing || existing.deletedAt || existing.projectId !== projectId) {
      return ApiErrors.notFound("Task")
    }

    // Verify taskOrder is unique within the project (among non-deleted tasks, excluding self)
    if (validation.data.taskOrder !== undefined) {
      const existingOrder = await db.task.findFirst({
        where: { projectId, taskOrder: validation.data.taskOrder, deletedAt: null, id: { not: taskId } },
      })
      if (existingOrder) {
        return ApiErrors.conflict(`A task with order ${validation.data.taskOrder} already exists in this project`)
      }
    }

    return db.task.update({
      where: { id: taskId },
      data: updateData,
    })
  })

  if (result instanceof Response) {
    return result
  }

  return successResponse(result, "Task updated")
})

export const DELETE = withAdminOrProjectRole<Params>("MANAGER", async (actor, _request: NextRequest, params) => {
  const { projectId, taskId } = params!

  const result = await withRLS(actor, async (db) => {
    const existing = await db.task.findUnique({ where: { id: taskId } })
    if (!existing || existing.deletedAt || existing.projectId !== projectId) {
      return ApiErrors.notFound("Task")
    }

    return db.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
    })
  })

  if (result instanceof Response) {
    return result
  }

  return successResponse(result, "Task deleted")
})

export async function PUT() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
export async function POST() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
