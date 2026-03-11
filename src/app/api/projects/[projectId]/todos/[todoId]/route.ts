import { NextRequest } from "next/server"
import { withRLS } from "@/lib/prisma/rls"
import {
  successResponse,
  handleUnsupportedMethod,
  parseZodError,
  ApiErrors,
} from "@/lib/utils/api-response"
import { withAdminOrProjectRole } from "@/lib/utils/api-route-helper"
import { updateTodoSchema } from "@/lib/validations/todo"

type Params = { projectId: string; todoId: string }

export const GET = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (actor, _request: NextRequest, params) => {
  const { projectId, todoId } = params!

  return withRLS(actor, async (db) => {
    const todo = await db.todo.findUnique({
      where: { id: todoId },
      include: {
        responsible: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    if (!todo || todo.deletedAt || todo.projectId !== projectId) {
      return ApiErrors.notFound("Todo")
    }

    return successResponse(todo)
  })
})

export const PATCH = withAdminOrProjectRole<Params>("MANAGER", async (actor, request: NextRequest, params) => {
  const { projectId, todoId } = params!

  const body = await request.json()
  const validation = updateTodoSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  const { version, deliveryDate, ...fields } = validation.data

  return withRLS(actor, async (db) => {
    // Validate responsible is a project member
    if (fields.responsibleId) {
      const member = await db.projectMember.findUnique({
        where: {
          projectId_actorId: { projectId, actorId: fields.responsibleId },
        },
      })
      if (!member || member.deletedAt) {
        return ApiErrors.validationError("Responsible person must be a project member")
      }
    }

    const updateData: Record<string, unknown> = {
      ...fields,
      ...(deliveryDate !== undefined && { deliveryDate: deliveryDate ? new Date(deliveryDate) : null }),
      version: { increment: 1 },
    }

    const { count } = await db.todo.updateMany({
      where: { id: todoId, version, projectId, deletedAt: null },
      data: updateData,
    })

    if (count === 0) {
      const existing = await db.todo.findUnique({ where: { id: todoId } })
      if (!existing || existing.deletedAt || existing.projectId !== projectId) {
        return ApiErrors.notFound("Todo")
      }
      return ApiErrors.conflict("Record was modified by another user. Please refresh and try again.")
    }

    const todo = await db.todo.findUnique({
      where: { id: todoId },
      include: {
        responsible: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return successResponse(todo, "Todo updated")
  })
})

export const DELETE = withAdminOrProjectRole<Params>("MANAGER", async (actor, _request: NextRequest, params) => {
  const { projectId, todoId } = params!

  return withRLS(actor, async (db) => {
    const existing = await db.todo.findUnique({ where: { id: todoId } })
    if (!existing || existing.deletedAt || existing.projectId !== projectId) {
      return ApiErrors.notFound("Todo")
    }

    const todo = await db.todo.update({
      where: { id: todoId },
      data: { deletedAt: new Date() },
    })

    return successResponse(todo, "Todo deleted")
  })
})

export async function PUT() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
export async function POST() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
