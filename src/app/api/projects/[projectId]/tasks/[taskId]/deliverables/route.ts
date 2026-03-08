import { NextRequest } from "next/server"
import { withRLS } from "@/lib/prisma/rls"
import {
  successResponse,
  handleUnsupportedMethod,
  parseZodError,
  ApiErrors,
  HTTP_STATUS,
} from "@/lib/utils/api-response"
import { withAdminOrProjectRole } from "@/lib/utils/api-route-helper"
import { createDeliverableSchema } from "@/lib/validations/deliverable"

type Params = { projectId: string; taskId: string }

export const GET = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (actor, _request: NextRequest, params) => {
  const { projectId, taskId } = params!

  return withRLS(actor, async (db) => {
    const task = await db.task.findUnique({ where: { id: taskId } })
    if (!task || task.deletedAt || task.projectId !== projectId) {
      return ApiErrors.notFound("Task")
    }

    const deliverables = await db.deliverable.findMany({
      where: { taskId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { attachments: true } },
      },
    })

    return successResponse(deliverables)
  })
})

export const POST = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (actor, request: NextRequest, params, projectRole) => {
  const { projectId, taskId } = params!

  const body = await request.json()
  const validation = createDeliverableSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  const result = await withRLS(actor, async (db) => {
    const task = await db.task.findUnique({ where: { id: taskId } })
    if (!task || task.deletedAt || task.projectId !== projectId) {
      return ApiErrors.notFound("Task")
    }

    // Check permission: MANAGER+ or task owner
    if (actor.systemRole !== "ADMIN" && projectRole !== "DIRECTOR" && projectRole !== "MANAGER") {
      if (task.ownerId !== actor.id) {
        return ApiErrors.forbidden("Requires MANAGER role or task owner access")
      }
    }

    return db.deliverable.create({
      data: {
        ...validation.data,
        taskId,
        createdById: actor.id,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { attachments: true } },
      },
    })
  })

  if (result instanceof Response) {
    return result
  }

  return successResponse(result, "Deliverable created", HTTP_STATUS.CREATED)
})

export async function PUT() { return handleUnsupportedMethod(["GET", "POST"]) }
export async function DELETE() { return handleUnsupportedMethod(["GET", "POST"]) }
export async function PATCH() { return handleUnsupportedMethod(["GET", "POST"]) }
