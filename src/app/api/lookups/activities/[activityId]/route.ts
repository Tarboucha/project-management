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

type Params = { activityId: string }

export const GET = withAnyAuth<Params>(async (actor, _request: NextRequest, params): Promise<NextResponse> => {
  const { activityId } = params!

  return withRLS(actor, async (db) => {
    const activity = await db.activity.findUnique({
      where: { id: activityId },
    })

    if (!activity || activity.deletedAt) {
      return ApiErrors.notFound("Activity")
    }

    return successResponse(activity)
  })
})

export const PATCH = withAdmin<Params>(async (actor, request: NextRequest, params): Promise<NextResponse> => {
  const { activityId } = params!

  const body = await request.json()
  const validation = updateLookupSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  return withRLS(actor, async (db) => {
    const existing = await db.activity.findUnique({ where: { id: activityId } })
    if (!existing || existing.deletedAt) {
      return ApiErrors.notFound("Activity")
    }

    const activity = await db.activity.update({
      where: { id: activityId },
      data: validation.data,
    })

    return successResponse(activity, "Activity updated")
  })
})

export const DELETE = withAdmin<Params>(async (actor, _request: NextRequest, params): Promise<NextResponse> => {
  const { activityId } = params!

  return withRLS(actor, async (db) => {
    const existing = await db.activity.findUnique({ where: { id: activityId } })
    if (!existing || existing.deletedAt) {
      return ApiErrors.notFound("Activity")
    }

    const activity = await db.activity.update({
      where: { id: activityId },
      data: { deletedAt: new Date() },
    })

    return successResponse(activity, "Activity deleted")
  })
})

export async function PUT(): Promise<NextResponse> { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
export async function POST(): Promise<NextResponse> { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
