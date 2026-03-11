import { NextRequest, NextResponse } from "next/server"
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
import { createLookupSchema } from "@/lib/validations/lookups"
import type { Prisma } from "@/generated/prisma/client"

export const GET = withAnyAuth(async (actor, request: NextRequest): Promise<NextResponse> => {
  const searchParams = request.nextUrl.searchParams
  const pagination = parseCursorPagination(searchParams)
  const filters = parseFilters(searchParams, ["search", "isActive"])
  const sorting = parseSorting(searchParams, ["name", "createdAt"], "name", "asc")

  const where: Prisma.ThemeWhereInput = {
    deletedAt: null,
    ...(filters.isActive !== undefined && { isActive: filters.isActive === "true" }),
    ...(filters.search && {
      name: { contains: filters.search, mode: "insensitive" as const },
    }),
  }

  return withRLS(actor, async (db) => {
    const themes = await db.theme.findMany({
      where,
      take: pagination.limit + 1,
      ...(pagination.cursor && {
        cursor: { id: pagination.cursor },
        skip: 1,
      }),
      orderBy: [{ [sorting.field]: sorting.order }, { id: "desc" as const }],
      include: { _count: { select: { projects: { where: { deletedAt: null } } } } },
    })

    return cursorPaginatedResponse(themes, pagination)
  })
})

export const POST = withAdmin(async (actor, request: NextRequest): Promise<NextResponse> => {
  const body = await request.json()
  const validation = createLookupSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  const theme = await withRLS(actor, async (db) => {
    return db.theme.create({
      data: validation.data,
    })
  })

  return successResponse(theme, "Theme created", HTTP_STATUS.CREATED)
})

export async function PUT(): Promise<NextResponse> { return handleUnsupportedMethod(["GET", "POST"]) }
export async function DELETE(): Promise<NextResponse> { return handleUnsupportedMethod(["GET", "POST"]) }
export async function PATCH(): Promise<NextResponse> { return handleUnsupportedMethod(["GET", "POST"]) }
