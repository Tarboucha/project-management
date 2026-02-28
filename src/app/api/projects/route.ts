import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  handleUnsupportedMethod,
  parseCursorPagination,
  cursorPaginatedResponse,
  parseFilters,
  parseMultiFilters,
  parseSorting,
} from "@/lib/utils/api-response"
import { withAnyAuth } from "@/lib/utils/api-route-helper"
import type { Prisma } from "@/generated/prisma/client"

export const GET = withAnyAuth(async (actor, request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams
  const pagination = parseCursorPagination(searchParams)
  const filters = parseFilters(searchParams, ["state", "search", "programId"])
  const multiFilters = parseMultiFilters(searchParams, ["activityId", "themeId", "categoryId"])
  const sorting = parseSorting(searchParams, ["name", "createdAt", "startDate", "progress", "state", "programName", "members", "tasks"])

  // Map sort fields to Prisma orderBy (some require nested/relation syntax)
  const orderByMap: Record<string, Prisma.ProjectOrderByWithRelationInput> = {
    name: { name: sorting.order },
    createdAt: { createdAt: sorting.order },
    startDate: { startDate: sorting.order },
    progress: { progress: sorting.order },
    state: { state: sorting.order },
    programName: { program: { name: sorting.order } },
    members: { members: { _count: sorting.order } },
    tasks: { tasks: { _count: sorting.order } },
  }
  const orderBy = orderByMap[sorting.field] ?? { createdAt: sorting.order }

  const where: Prisma.ProjectWhereInput = {
    deletedAt: null,
    ...(filters.state && { state: filters.state as "ACTIVE" | "ENDED" }),
    ...(filters.search && {
      name: { contains: filters.search, mode: "insensitive" as const },
    }),
    ...(filters.programId && { programId: filters.programId }),
    ...(multiFilters.activityId && { activityId: { in: multiFilters.activityId } }),
    ...(multiFilters.themeId && { themeId: { in: multiFilters.themeId } }),
    ...(multiFilters.categoryId && { categoryId: { in: multiFilters.categoryId } }),
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
    orderBy,
    include: {
      program: { select: { id: true, name: true } },
      activity: { select: { id: true, name: true } },
      theme: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
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

export async function POST() { return handleUnsupportedMethod(["GET"]) }
export async function PUT() { return handleUnsupportedMethod(["GET"]) }
export async function DELETE() { return handleUnsupportedMethod(["GET"]) }
export async function PATCH() { return handleUnsupportedMethod(["GET"]) }
