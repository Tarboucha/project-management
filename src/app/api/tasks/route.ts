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
  const filters = parseFilters(searchParams, ["state", "search", "priority", "owner"])
  const sorting = parseSorting(
    searchParams,
    ["objective", "createdAt", "startDate", "priority", "progress"],
    "startDate",
    "asc",
  )

  const isAdmin = actor.systemRole === "ADMIN"

  const where: Prisma.TaskWhereInput = {
    deletedAt: null,
    ...(filters.state && { state: filters.state as "ACTIVE" | "ENDED" }),
    ...(filters.search && {
      objective: { contains: filters.search, mode: "insensitive" as const },
    }),
    ...(filters.priority && { priority: filters.priority as "LOW" | "NORMAL" | "MEDIUM" | "HIGH" | "URGENT" }),
    // "me" shorthand resolves to the current actor
    ...(filters.owner === "me" && { ownerId: actor.id }),
    ...(filters.owner && filters.owner !== "me" && { ownerId: filters.owner }),
    // Non-admin: only tasks from projects they're a member of
    ...(!isAdmin && {
      project: {
        members: { some: { actorId: actor.id, deletedAt: null } },
      },
    }),
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
        project: { select: { id: true, name: true } },
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

export async function POST() { return handleUnsupportedMethod(["GET"]) }
export async function PUT() { return handleUnsupportedMethod(["GET"]) }
export async function DELETE() { return handleUnsupportedMethod(["GET"]) }
export async function PATCH() { return handleUnsupportedMethod(["GET"]) }
