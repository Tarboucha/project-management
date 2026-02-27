import { NextRequest, NextResponse } from "next/server"
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
import { createLookupSchema } from "@/lib/validations/lookups"
import { auditLog } from "@/lib/utils/audit"
import type { Prisma } from "@/generated/prisma/client"

export const GET = withAnyAuth(async (_actor, request: NextRequest): Promise<NextResponse> => {
  const searchParams = request.nextUrl.searchParams
  const pagination = parseCursorPagination(searchParams)
  const filters = parseFilters(searchParams, ["search", "isActive"])
  const sorting = parseSorting(searchParams, ["name", "createdAt"], "name", "asc")

  const where: Prisma.ActivityWhereInput = {
    deletedAt: null,
    ...(filters.isActive !== undefined && { isActive: filters.isActive === "true" }),
    ...(filters.search && {
      name: { contains: filters.search, mode: "insensitive" as const },
    }),
  }

  const activities = await prisma.activity.findMany({
    where,
    take: pagination.limit + 1,
    ...(pagination.cursor && {
      cursor: { id: pagination.cursor },
      skip: 1,
    }),
    orderBy: { [sorting.field]: sorting.order },
  })

  return cursorPaginatedResponse(activities, pagination)
})

export const POST = withAdmin(async (actor, request: NextRequest): Promise<NextResponse> => {
  const body = await request.json()
  const validation = createLookupSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  const activity = await prisma.activity.create({
    data: validation.data,
  })

  await auditLog({
    entityType: "Activity",
    entityId: activity.id,
    action: "CREATE",
    actorId: actor.id,
    newData: activity,
  })

  return successResponse(activity, "Activity created", HTTP_STATUS.CREATED)
})

export async function PUT(): Promise<NextResponse> { return handleUnsupportedMethod(["GET", "POST"]) }
export async function DELETE(): Promise<NextResponse> { return handleUnsupportedMethod(["GET", "POST"]) }
export async function PATCH(): Promise<NextResponse> { return handleUnsupportedMethod(["GET", "POST"]) }
