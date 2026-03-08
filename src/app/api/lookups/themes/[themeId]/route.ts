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

type Params = { themeId: string }

export const GET = withAnyAuth<Params>(async (actor, _request: NextRequest, params): Promise<NextResponse> => {
  const { themeId } = params!

  return withRLS(actor, async (db) => {
    const theme = await db.theme.findUnique({
      where: { id: themeId },
    })

    if (!theme || theme.deletedAt) {
      return ApiErrors.notFound("Theme")
    }

    return successResponse(theme)
  })
})

export const PATCH = withAdmin<Params>(async (actor, request: NextRequest, params): Promise<NextResponse> => {
  const { themeId } = params!

  const body = await request.json()
  const validation = updateLookupSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  return withRLS(actor, async (db) => {
    const existing = await db.theme.findUnique({ where: { id: themeId } })
    if (!existing || existing.deletedAt) {
      return ApiErrors.notFound("Theme")
    }

    const theme = await db.theme.update({
      where: { id: themeId },
      data: validation.data,
    })

    return successResponse(theme, "Theme updated")
  })
})

export const DELETE = withAdmin<Params>(async (actor, _request: NextRequest, params): Promise<NextResponse> => {
  const { themeId } = params!

  return withRLS(actor, async (db) => {
    const existing = await db.theme.findUnique({ where: { id: themeId } })
    if (!existing || existing.deletedAt) {
      return ApiErrors.notFound("Theme")
    }

    const theme = await db.theme.update({
      where: { id: themeId },
      data: { deletedAt: new Date() },
    })

    return successResponse(theme, "Theme deleted")
  })
})

export async function PUT(): Promise<NextResponse> { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
export async function POST(): Promise<NextResponse> { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
