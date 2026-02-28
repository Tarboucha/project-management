import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
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
import { auditLog } from "@/lib/utils/audit"
import type { Prisma } from "@/generated/prisma/client"

type Params = { projectId: string }

export const GET = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (_actor, request: NextRequest, params) => {
  const { projectId } = params!

  const searchParams = request.nextUrl.searchParams
  const pagination = parseCursorPagination(searchParams)
  const filters = parseFilters(searchParams, ["state", "search", "milestoneId", "priority"])
  const sorting = parseSorting(searchParams, ["taskOrder", "objective", "createdAt", "startDate", "priority", "progress"], "taskOrder", "asc")

  const where: Prisma.TaskWhereInput = {
    projectId,
    deletedAt: null,
    ...(filters.state && { state: filters.state as "ACTIVE" | "ENDED" }),
    ...(filters.search && {
      objective: { contains: filters.search, mode: "insensitive" as const },
    }),
    ...(filters.milestoneId && { milestoneId: filters.milestoneId }),
    ...(filters.priority && { priority: filters.priority as "LOW" | "NORMAL" | "MEDIUM" | "HIGH" | "URGENT" }),
  }

  const tasks = await prisma.task.findMany({
    where,
    take: pagination.limit + 1,
    ...(pagination.cursor && {
      cursor: { id: pagination.cursor },
      skip: 1,
    }),
    orderBy: { [sorting.field]: sorting.order },
    include: {
      contributors: {
        include: { actor: { select: { id: true, firstName: true, lastName: true } } },
      },
      milestone: { select: { id: true, name: true } },
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

export const POST = withAdminOrProjectRole<Params>("MANAGER", async (actor, request: NextRequest, params) => {
  const { projectId } = params!

  const body = await request.json()
  const validation = createTaskSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  // Verify taskOrder is unique within the project (among non-deleted tasks)
  const existingOrder = await prisma.task.findFirst({
    where: { projectId, taskOrder: validation.data.taskOrder, deletedAt: null },
  })
  if (existingOrder) {
    return ApiErrors.conflict(`A task with order ${validation.data.taskOrder} already exists in this project`)
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

  const task = await prisma.task.create({
    data: {
      ...validation.data,
      startDate: new Date(validation.data.startDate),
      ...(validation.data.endDate && { endDate: new Date(validation.data.endDate) }),
      projectId,
      createdById: actor.id,
    },
  })

  await auditLog({ entityType: "Task", entityId: task.id, action: "CREATE", actorId: actor.id, newData: task })

  return successResponse(task, "Task created", HTTP_STATUS.CREATED)
})

export async function PUT() { return handleUnsupportedMethod(["GET", "POST"]) }
export async function DELETE() { return handleUnsupportedMethod(["GET", "POST"]) }
export async function PATCH() { return handleUnsupportedMethod(["GET", "POST"]) }
