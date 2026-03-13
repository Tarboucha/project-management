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
import { withAnyAuth, withAdmin } from "@/lib/utils/api-route-helper"
import { createProgramSchema } from "@/lib/validations/program"
import type { Prisma } from "@/generated/prisma/client"

export const GET = withAnyAuth(async (actor, request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams
  const pagination = parseCursorPagination(searchParams)
  const filters = parseFilters(searchParams, ["state", "search"])
  const sorting = parseSorting(searchParams, ["name", "createdAt", "startDate", "state"], "name", "asc")

  const where: Prisma.ProgramWhereInput = {
    deletedAt: null,
    ...(filters.state && { state: filters.state as "ACTIVE" | "ENDED" }),
    ...(filters.search && {
      name: { contains: filters.search, mode: "insensitive" as const },
    }),
    // Non-admin: only programs where actor has a project membership
    ...(actor.systemRole !== "ADMIN" && {
      projects: {
        some: {
          deletedAt: null,
          members: { some: { actorId: actor.id, deletedAt: null } },
        },
      },
    }),
  }

  const programs = await withRLS(actor, (db) =>
    db.program.findMany({
      where,
      take: pagination.limit + 1,
      ...(pagination.cursor && {
        cursor: { id: pagination.cursor },
        skip: 1,
      }),
      orderBy: [{ [sorting.field]: sorting.order }, { id: "desc" as const }],
      include: {
        _count: { select: { projects: { where: { deletedAt: null } } } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })
  )

  return cursorPaginatedResponse(programs, pagination)
})

export const POST = withAdmin(async (actor, request: NextRequest) => {
  const body = await request.json()
  const validation = createProgramSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  const program = await withRLS(actor, (db) =>
    db.program.create({
      data: {
        ...validation.data,
        startDate: new Date(validation.data.startDate),
        ...(validation.data.endDate && { endDate: new Date(validation.data.endDate) }),
        createdById: actor.id,
      },
    })
  )

  return successResponse(program, "Program created", HTTP_STATUS.CREATED)
})

export async function PUT() { return handleUnsupportedMethod(["GET", "POST"]) }
export async function DELETE() { return handleUnsupportedMethod(["GET", "POST"]) }
export async function PATCH() { return handleUnsupportedMethod(["GET", "POST"]) }
