import { NextRequest } from "next/server"
import { withRLS } from "@/lib/prisma/rls"
import {
  successResponse,
  handleUnsupportedMethod,
  parseCursorPagination,
  cursorPaginatedResponse,
  parseFilters,
  parseSorting,
  parseZodError,
  ApiErrors,
  HTTP_STATUS,
} from "@/lib/utils/api-response"
import { withAdminOrProjectRole } from "@/lib/utils/api-route-helper"
import { createTaskSchema } from "@/lib/validations/task"
import type { Prisma } from "@/generated/prisma/client"

type Params = { projectId: string }

export const GET = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (actor, request: NextRequest, params) => {
  const { projectId } = params!

  const searchParams = request.nextUrl.searchParams
  const pagination = parseCursorPagination(searchParams)
  const filters = parseFilters(searchParams, ["state", "search", "priority"])
  const sorting = parseSorting(searchParams, ["taskOrder", "objective", "createdAt", "startDate", "priority", "progress", "state"], "taskOrder", "asc")

  const where: Prisma.TaskWhereInput = {
    projectId,
    deletedAt: null,
    ...(filters.state && { state: filters.state as "ACTIVE" | "ENDED" }),
    ...(filters.search && {
      objective: { contains: filters.search, mode: "insensitive" as const },
    }),
    ...(filters.priority && { priority: filters.priority as "LOW" | "NORMAL" | "MEDIUM" | "HIGH" | "URGENT" }),
  }

  return withRLS(actor, async (db) => {
    const tasks = await db.task.findMany({
      where,
      take: pagination.limit + 1,
      ...(pagination.cursor && {
        cursor: { id: pagination.cursor },
        skip: 1,
      }),
      orderBy: [{ [sorting.field]: sorting.order }, { id: "desc" as const }],
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        _count: {
          select: {
            deliverables: { where: { deletedAt: null } },
            timeEntries: { where: { deletedAt: null } },
          },
        },
      },
    })

    return cursorPaginatedResponse(tasks, pagination)
  })
})

export const POST = withAdminOrProjectRole<Params>("MANAGER", async (actor, request: NextRequest, params) => {
  const { projectId } = params!

  const body = await request.json()
  const validation = createTaskSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  const result = await withRLS(actor, async (db) => {
    // Verify taskOrder is unique within the project (among non-deleted tasks)
    const existingOrder = await db.task.findFirst({
      where: { projectId, taskOrder: validation.data.taskOrder, deletedAt: null },
    })
    if (existingOrder) {
      return ApiErrors.conflict(`A task with order ${validation.data.taskOrder} already exists in this project`)
    }

    return db.task.create({
      data: {
        ...validation.data,
        startDate: new Date(validation.data.startDate),
        ...(validation.data.endDate && { endDate: new Date(validation.data.endDate) }),
        projectId,
        createdById: actor.id,
      },
    })
  })

  if (result instanceof Response) {
    return result
  }

  return successResponse(result, "Task created", HTTP_STATUS.CREATED)
})

export async function PUT() { return handleUnsupportedMethod(["GET", "POST"]) }
export async function DELETE() { return handleUnsupportedMethod(["GET", "POST"]) }
export async function PATCH() { return handleUnsupportedMethod(["GET", "POST"]) }
