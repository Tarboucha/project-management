import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  handleUnsupportedMethod,
  parseFilters,
  parseCursorPagination,
  cursorPaginatedResponse,
} from "@/lib/utils/api-response"
import { withAnyAuth } from "@/lib/utils/api-route-helper"
import type { Prisma } from "@/generated/prisma/client"

export const GET = withAnyAuth(async (_actor, request: NextRequest): Promise<NextResponse> => {
  const searchParams = request.nextUrl.searchParams
  const filters = parseFilters(searchParams, ["search"])
  const excludeProjectId = searchParams.get("excludeProjectId")

  const where: Prisma.ActorWhereInput = {
    deletedAt: null,
    isActive: true,
    ...(filters.search && {
      OR: [
        { firstName: { contains: filters.search, mode: "insensitive" as const } },
        { lastName: { contains: filters.search, mode: "insensitive" as const } },
        { email: { contains: filters.search, mode: "insensitive" as const } },
      ],
    }),
    ...(excludeProjectId && {
      projectMembers: {
        none: { projectId: excludeProjectId },
      },
    }),
  }

  const pagination = parseCursorPagination(searchParams)

  const actors = await prisma.actor.findMany({
    where,
    take: pagination.limit + 1,
    ...(pagination.cursor && {
      cursor: { id: pagination.cursor },
      skip: 1,
    }),
    orderBy: { firstName: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  })

  return cursorPaginatedResponse(actors, pagination)
})

export async function POST(): Promise<NextResponse> { return handleUnsupportedMethod(["GET"]) }
export async function PUT(): Promise<NextResponse> { return handleUnsupportedMethod(["GET"]) }
export async function DELETE(): Promise<NextResponse> { return handleUnsupportedMethod(["GET"]) }
export async function PATCH(): Promise<NextResponse> { return handleUnsupportedMethod(["GET"]) }
