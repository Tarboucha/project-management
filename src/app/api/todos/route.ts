import { NextRequest, NextResponse } from "next/server"
import { withRLS } from "@/lib/prisma/rls"
import {
  handleUnsupportedMethod,
  parseCursorPagination,
  cursorPaginatedResponse,
  parseFilters,
  parseSorting,
} from "@/lib/utils/api-response"
import { withAnyAuth } from "@/lib/utils/api-route-helper"
import type { Prisma } from "@/generated/prisma/client"

export const GET = withAnyAuth(async (actor, request: NextRequest): Promise<NextResponse> => {
  const searchParams = request.nextUrl.searchParams
  const pagination = parseCursorPagination(searchParams)
  const filters = parseFilters(searchParams, ["status", "search", "responsible"])
  const sorting = parseSorting(
    searchParams,
    ["action", "createdAt", "deliveryDate", "todoOrder"],
    "deliveryDate",
    "asc",
  )

  const isAdmin = actor.systemRole === "ADMIN"

  const where: Prisma.TodoWhereInput = {
    deletedAt: null,
    ...(filters.status && { status: filters.status as "ACTIVE" | "INACTIVE" }),
    ...(filters.search && {
      action: { contains: filters.search, mode: "insensitive" as const },
    }),
    // "me" shorthand resolves to the current actor
    ...(filters.responsible === "me" && { responsibleId: actor.id }),
    ...(filters.responsible && filters.responsible !== "me" && { responsibleId: filters.responsible }),
    // Non-admin: only todos from projects they're a member of
    ...(!isAdmin && {
      project: {
        members: { some: { actorId: actor.id, deletedAt: null } },
      },
    }),
  }

  return withRLS(actor, async (db) => {
    const todos = await db.todo.findMany({
      where,
      take: pagination.limit + 1,
      ...(pagination.cursor && {
        cursor: { id: pagination.cursor },
        skip: 1,
      }),
      orderBy: [{ [sorting.field]: sorting.order }, { id: "desc" as const }],
      include: {
        responsible: { select: { id: true, firstName: true, lastName: true } },
        project: { select: { id: true, name: true } },
      },
    })

    return cursorPaginatedResponse(todos, pagination)
  })
})

export async function POST() { return handleUnsupportedMethod(["GET"]) }
export async function PUT() { return handleUnsupportedMethod(["GET"]) }
export async function DELETE() { return handleUnsupportedMethod(["GET"]) }
export async function PATCH() { return handleUnsupportedMethod(["GET"]) }
