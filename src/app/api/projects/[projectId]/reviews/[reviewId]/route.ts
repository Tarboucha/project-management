import { NextRequest } from "next/server"
import { withRLS } from "@/lib/prisma/rls"
import {
  successResponse,
  handleUnsupportedMethod,
  parseZodError,
  ApiErrors,
} from "@/lib/utils/api-response"
import { withAdminOrProjectRole } from "@/lib/utils/api-route-helper"
import { updateReviewSchema } from "@/lib/validations/review"

type Params = { projectId: string; reviewId: string }

export const GET = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (actor, _request: NextRequest, params) => {
  const { projectId, reviewId } = params!

  return withRLS(actor, async (db) => {
    const review = await db.review.findUnique({
      where: { id: reviewId },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    if (!review || review.deletedAt || review.projectId !== projectId) {
      return ApiErrors.notFound("Review")
    }

    return successResponse(review)
  })
})

export const PATCH = withAdminOrProjectRole<Params>("MANAGER", async (actor, request: NextRequest, params) => {
  const { projectId, reviewId } = params!

  const body = await request.json()
  const validation = updateReviewSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  const { version, reviewDate, ...fields } = validation.data

  return withRLS(actor, async (db) => {
    const updateData: Record<string, unknown> = {
      ...fields,
      ...(reviewDate !== undefined && { reviewDate: new Date(reviewDate) }),
      version: { increment: 1 },
    }

    const { count } = await db.review.updateMany({
      where: { id: reviewId, version, projectId, deletedAt: null },
      data: updateData,
    })

    if (count === 0) {
      const existing = await db.review.findUnique({ where: { id: reviewId } })
      if (!existing || existing.deletedAt || existing.projectId !== projectId) {
        return ApiErrors.notFound("Review")
      }
      return ApiErrors.conflict("Record was modified by another user. Please refresh and try again.")
    }

    const review = await db.review.findUnique({
      where: { id: reviewId },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return successResponse(review, "Review updated")
  })
})

export const DELETE = withAdminOrProjectRole<Params>("MANAGER", async (actor, _request: NextRequest, params) => {
  const { projectId, reviewId } = params!

  return withRLS(actor, async (db) => {
    const existing = await db.review.findUnique({ where: { id: reviewId } })
    if (!existing || existing.deletedAt || existing.projectId !== projectId) {
      return ApiErrors.notFound("Review")
    }

    const review = await db.review.update({
      where: { id: reviewId },
      data: { deletedAt: new Date() },
    })

    return successResponse(review, "Review deleted")
  })
})

export async function PUT() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
export async function POST() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
