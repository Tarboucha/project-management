import { NextRequest } from "next/server"
import { withRLS } from "@/lib/prisma/rls"
import {
  successResponse,
  handleUnsupportedMethod,
  parseZodError,
  ApiErrors,
  HTTP_STATUS,
} from "@/lib/utils/api-response"
import { withAdminOrProjectRole } from "@/lib/utils/api-route-helper"
import { createReviewSchema } from "@/lib/validations/review"

type Params = { projectId: string }

export const GET = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (actor, _request: NextRequest, params) => {
  const { projectId } = params!

  return withRLS(actor, async (db) => {
    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project || project.deletedAt) {
      return ApiErrors.notFound("Project")
    }

    const reviews = await db.review.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { reviewDate: "desc" },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return successResponse(reviews)
  })
})

export const POST = withAdminOrProjectRole<Params>("MANAGER", async (actor, request: NextRequest, params) => {
  const { projectId } = params!

  const body = await request.json()
  const validation = createReviewSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  const result = await withRLS(actor, async (db) => {
    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project || project.deletedAt) {
      return ApiErrors.notFound("Project")
    }

    return db.review.create({
      data: {
        reviewDate: new Date(validation.data.reviewDate),
        notes: validation.data.notes,
        projectId,
        createdById: actor.id,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })
  })

  if (result instanceof Response) {
    return result
  }

  return successResponse(result, "Review created", HTTP_STATUS.CREATED)
})

export async function PUT() { return handleUnsupportedMethod(["GET", "POST"]) }
export async function DELETE() { return handleUnsupportedMethod(["GET", "POST"]) }
export async function PATCH() { return handleUnsupportedMethod(["GET", "POST"]) }
