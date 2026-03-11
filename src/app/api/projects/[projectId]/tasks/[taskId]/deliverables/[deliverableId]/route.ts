import { NextRequest } from "next/server"
import { withRLS } from "@/lib/prisma/rls"
import {
  successResponse,
  handleUnsupportedMethod,
  parseZodError,
  ApiErrors,
} from "@/lib/utils/api-response"
import { withAdminOrProjectRole } from "@/lib/utils/api-route-helper"
import { updateDeliverableSchema } from "@/lib/validations/deliverable"

type Params = { projectId: string; taskId: string; deliverableId: string }

export const GET = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (actor, _request: NextRequest, params) => {
  const { projectId, taskId, deliverableId } = params!

  return withRLS(actor, async (db) => {
    const deliverable = await db.deliverable.findUnique({
      where: { id: deliverableId },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        attachments: {
          select: {
            id: true,
            name: true,
            fileType: true,
            fileSize: true,
            createdAt: true,
            uploadedBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!deliverable || deliverable.deletedAt || deliverable.taskId !== taskId) {
      return ApiErrors.notFound("Deliverable")
    }

    // Verify task belongs to project
    const task = await db.task.findUnique({ where: { id: taskId } })
    if (!task || task.deletedAt || task.projectId !== projectId) {
      return ApiErrors.notFound("Task")
    }

    return successResponse(deliverable)
  })
})

export const PATCH = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (actor, request: NextRequest, params, projectRole) => {
  const { projectId, taskId, deliverableId } = params!

  const body = await request.json()
  const validation = updateDeliverableSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  const { version, ...fields } = validation.data

  return withRLS(actor, async (db) => {
    const task = await db.task.findUnique({ where: { id: taskId } })
    if (!task || task.deletedAt || task.projectId !== projectId) {
      return ApiErrors.notFound("Task")
    }

    // Check permission: MANAGER+ or deliverable creator
    const existing = await db.deliverable.findUnique({ where: { id: deliverableId } })
    if (!existing || existing.deletedAt || existing.taskId !== taskId) {
      return ApiErrors.notFound("Deliverable")
    }

    if (actor.systemRole !== "ADMIN" && projectRole !== "DIRECTOR" && projectRole !== "MANAGER") {
      if (existing.createdById !== actor.id) {
        return ApiErrors.forbidden("Requires MANAGER role or deliverable ownership")
      }
    }

    const { count } = await db.deliverable.updateMany({
      where: { id: deliverableId, version, deletedAt: null },
      data: {
        ...fields,
        version: { increment: 1 },
      },
    })

    if (count === 0) {
      return ApiErrors.conflict("Record was modified by another user. Please refresh and try again.")
    }

    const deliverable = await db.deliverable.findUnique({ where: { id: deliverableId } })
    return successResponse(deliverable, "Deliverable updated")
  })
})

export const DELETE = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (actor, _request: NextRequest, params, projectRole) => {
  const { projectId, taskId, deliverableId } = params!

  return withRLS(actor, async (db) => {
    const existing = await db.deliverable.findUnique({ where: { id: deliverableId } })
    if (!existing || existing.deletedAt || existing.taskId !== taskId) {
      return ApiErrors.notFound("Deliverable")
    }

    const task = await db.task.findUnique({ where: { id: taskId } })
    if (!task || task.deletedAt || task.projectId !== projectId) {
      return ApiErrors.notFound("Task")
    }

    // Check permission: MANAGER+ or deliverable creator
    if (actor.systemRole !== "ADMIN" && projectRole !== "DIRECTOR" && projectRole !== "MANAGER") {
      if (existing.createdById !== actor.id) {
        return ApiErrors.forbidden("Requires MANAGER role or deliverable ownership")
      }
    }

    const deliverable = await db.deliverable.update({
      where: { id: deliverableId },
      data: { deletedAt: new Date() },
    })

    return successResponse(deliverable, "Deliverable deleted")
  })
})

export async function PUT() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
export async function POST() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
