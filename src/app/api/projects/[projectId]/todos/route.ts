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
import { createTodoSchema } from "@/lib/validations/todo"

type Params = { projectId: string }

export const GET = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (actor, _request: NextRequest, params) => {
  const { projectId } = params!

  return withRLS(actor, async (db) => {
    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project || project.deletedAt) {
      return ApiErrors.notFound("Project")
    }

    const todos = await db.todo.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { todoOrder: "asc" },
      include: {
        responsible: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return successResponse(todos)
  })
})

export const POST = withAdminOrProjectRole<Params>("MANAGER", async (actor, request: NextRequest, params) => {
  const { projectId } = params!

  const body = await request.json()
  const validation = createTodoSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  const result = await withRLS(actor, async (db) => {
    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project || project.deletedAt) {
      return ApiErrors.notFound("Project")
    }

    // Validate responsible is a project member
    if (validation.data.responsibleId) {
      const member = await db.projectMember.findUnique({
        where: {
          projectId_actorId: { projectId, actorId: validation.data.responsibleId },
        },
      })
      if (!member || member.deletedAt) {
        return ApiErrors.validationError("Responsible person must be a project member")
      }
    }

    const { deliveryDate, ...rest } = validation.data
    return db.todo.create({
      data: {
        ...rest,
        ...(deliveryDate !== undefined && { deliveryDate: new Date(deliveryDate) }),
        projectId,
        createdById: actor.id,
      },
      include: {
        responsible: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })
  })

  if (result instanceof Response) {
    return result
  }

  return successResponse(result, "Todo created", HTTP_STATUS.CREATED)
})

export async function PUT() { return handleUnsupportedMethod(["GET", "POST"]) }
export async function DELETE() { return handleUnsupportedMethod(["GET", "POST"]) }
export async function PATCH() { return handleUnsupportedMethod(["GET", "POST"]) }
