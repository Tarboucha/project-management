import { NextRequest, NextResponse } from "next/server"
import { withRLS } from "@/lib/prisma/rls"
import {
  successResponse,
  handleUnsupportedMethod,
  parseZodError,
  ApiErrors,
} from "@/lib/utils/api-response"
import { withAnyAuth, withAdmin } from "@/lib/utils/api-route-helper"
import { updateLookupSchema } from "@/lib/validations/lookups"

type Params = { categoryId: string }

export const GET = withAnyAuth<Params>(async (actor, _request: NextRequest, params): Promise<NextResponse> => {
  const { categoryId } = params!

  return withRLS(actor, async (db) => {
    const category = await db.category.findUnique({
      where: { id: categoryId },
    })

    if (!category || category.deletedAt) {
      return ApiErrors.notFound("Category")
    }

    return successResponse(category)
  })
})

export const PATCH = withAdmin<Params>(async (actor, request: NextRequest, params): Promise<NextResponse> => {
  const { categoryId } = params!

  const body = await request.json()
  const validation = updateLookupSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  return withRLS(actor, async (db) => {
    const existing = await db.category.findUnique({ where: { id: categoryId } })
    if (!existing || existing.deletedAt) {
      return ApiErrors.notFound("Category")
    }

    const category = await db.category.update({
      where: { id: categoryId },
      data: validation.data,
    })

    return successResponse(category, "Category updated")
  })
})

export const DELETE = withAdmin<Params>(async (actor, _request: NextRequest, params): Promise<NextResponse> => {
  const { categoryId } = params!

  return withRLS(actor, async (db) => {
    const existing = await db.category.findUnique({ where: { id: categoryId } })
    if (!existing || existing.deletedAt) {
      return ApiErrors.notFound("Category")
    }

    const category = await db.category.update({
      where: { id: categoryId },
      data: { deletedAt: new Date() },
    })

    return successResponse(category, "Category deleted")
  })
})

export async function PUT(): Promise<NextResponse> { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
export async function POST(): Promise<NextResponse> { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
