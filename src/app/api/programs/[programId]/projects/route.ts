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
import { withAnyAuth, withAdmin } from "@/lib/utils/api-route-helper"
import { createProjectSchema } from "@/lib/validations/project"
import { auditLog } from "@/lib/utils/audit"
import type { Prisma } from "@/generated/prisma/client"

type Params = { programId: string }

export const GET = withAnyAuth<Params>(async (actor, request: NextRequest, params) => {
  const { programId } = params!

  // Verify program exists
  const program = await prisma.program.findUnique({ where: { id: programId } })
  if (!program || program.deletedAt) {
    return ApiErrors.notFound("Program")
  }

  const searchParams = request.nextUrl.searchParams
  const pagination = parseCursorPagination(searchParams)
  const filters = parseFilters(searchParams, ["state", "search"])
  const sorting = parseSorting(searchParams, ["name", "createdAt", "startDate", "progress"])

  const where: Prisma.ProjectWhereInput = {
    programId,
    deletedAt: null,
    ...(filters.state && { state: filters.state as "ACTIVE" | "ENDED" }),
    ...(filters.search && {
      name: { contains: filters.search, mode: "insensitive" as const },
    }),
    // Non-admin: only projects where actor is a member
    ...(actor.systemRole !== "ADMIN" && {
      members: { some: { actorId: actor.id } },
    }),
  }

  const projects = await prisma.project.findMany({
    where,
    take: pagination.limit + 1,
    ...(pagination.cursor && {
      cursor: { id: pagination.cursor },
      skip: 1,
    }),
    orderBy: { [sorting.field]: sorting.order },
    include: {
      _count: {
        select: {
          members: true,
          tasks: { where: { deletedAt: null } },
        },
      },
    },
  })

  return cursorPaginatedResponse(projects, pagination)
})

export const POST = withAdmin<Params>(async (actor, request: NextRequest, params) => {
  const { programId } = params!

  // Verify program exists
  const program = await prisma.program.findUnique({ where: { id: programId } })
  if (!program || program.deletedAt) {
    return ApiErrors.notFound("Program")
  }

  const body = await request.json()
  const validation = createProjectSchema.safeParse({ ...body, programId })

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  const project = await prisma.project.create({
    data: {
      ...validation.data,
      programId, // override from route param
      startDate: new Date(validation.data.startDate),
      ...(validation.data.endDate && { endDate: new Date(validation.data.endDate) }),
      createdById: actor.id,
    },
  })

  await auditLog({ entityType: "Project", entityId: project.id, action: "CREATE", actorId: actor.id, newData: project })

  return successResponse(project, "Project created", HTTP_STATUS.CREATED)
})

export async function PUT() { return handleUnsupportedMethod(["GET", "POST"]) }
export async function DELETE() { return handleUnsupportedMethod(["GET", "POST"]) }
export async function PATCH() { return handleUnsupportedMethod(["GET", "POST"]) }
