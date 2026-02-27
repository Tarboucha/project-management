import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  successResponse,
  handleUnsupportedMethod,
  parseZodError,
  ApiErrors,
} from "@/lib/utils/api-response"
import { withAnyAuth, withAdmin } from "@/lib/utils/api-route-helper"
import { updateLookupSchema } from "@/lib/validations/lookups"
import { auditLog } from "@/lib/utils/audit"

type Params = { activityId: string }

export const GET = withAnyAuth<Params>(async (_actor, _request: NextRequest, params): Promise<NextResponse> => {
  const { activityId } = params!

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
  })

  if (!activity || activity.deletedAt) {
    return ApiErrors.notFound("Activity")
  }

  return successResponse(activity)
})

export const PATCH = withAdmin<Params>(async (actor, request: NextRequest, params): Promise<NextResponse> => {
  const { activityId } = params!

  const existing = await prisma.activity.findUnique({ where: { id: activityId } })
  if (!existing || existing.deletedAt) {
    return ApiErrors.notFound("Activity")
  }

  const body = await request.json()
  const validation = updateLookupSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  const activity = await prisma.activity.update({
    where: { id: activityId },
    data: {
      ...validation.data,
      modifiedAt: new Date(),
    },
  })

  await auditLog({
    entityType: "Activity",
    entityId: activityId,
    action: "UPDATE",
    actorId: actor.id,
    oldData: existing,
    newData: activity,
  })

  return successResponse(activity, "Activity updated")
})

export const DELETE = withAdmin<Params>(async (actor, _request: NextRequest, params): Promise<NextResponse> => {
  const { activityId } = params!

  const existing = await prisma.activity.findUnique({ where: { id: activityId } })
  if (!existing || existing.deletedAt) {
    return ApiErrors.notFound("Activity")
  }

  const activity = await prisma.activity.update({
    where: { id: activityId },
    data: { deletedAt: new Date(), modifiedAt: new Date() },
  })

  await auditLog({
    entityType: "Activity",
    entityId: activityId,
    action: "DELETE",
    actorId: actor.id,
    oldData: existing,
  })

  return successResponse(activity, "Activity deleted")
})

export async function PUT(): Promise<NextResponse> { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
export async function POST(): Promise<NextResponse> { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
