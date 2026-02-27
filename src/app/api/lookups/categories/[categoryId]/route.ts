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

type Params = { categoryId: string }

export const GET = withAnyAuth<Params>(async (_actor, _request: NextRequest, params): Promise<NextResponse> => {
  const { categoryId } = params!

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  })

  if (!category || category.deletedAt) {
    return ApiErrors.notFound("Category")
  }

  return successResponse(category)
})

export const PATCH = withAdmin<Params>(async (actor, request: NextRequest, params): Promise<NextResponse> => {
  const { categoryId } = params!

  const existing = await prisma.category.findUnique({ where: { id: categoryId } })
  if (!existing || existing.deletedAt) {
    return ApiErrors.notFound("Category")
  }

  const body = await request.json()
  const validation = updateLookupSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  const category = await prisma.category.update({
    where: { id: categoryId },
    data: {
      ...validation.data,
      modifiedAt: new Date(),
    },
  })

  await auditLog({
    entityType: "Category",
    entityId: categoryId,
    action: "UPDATE",
    actorId: actor.id,
    oldData: existing,
    newData: category,
  })

  return successResponse(category, "Category updated")
})

export const DELETE = withAdmin<Params>(async (actor, _request: NextRequest, params): Promise<NextResponse> => {
  const { categoryId } = params!

  const existing = await prisma.category.findUnique({ where: { id: categoryId } })
  if (!existing || existing.deletedAt) {
    return ApiErrors.notFound("Category")
  }

  const category = await prisma.category.update({
    where: { id: categoryId },
    data: { deletedAt: new Date(), modifiedAt: new Date() },
  })

  await auditLog({
    entityType: "Category",
    entityId: categoryId,
    action: "DELETE",
    actorId: actor.id,
    oldData: existing,
  })

  return successResponse(category, "Category deleted")
})

export async function PUT(): Promise<NextResponse> { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
export async function POST(): Promise<NextResponse> { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
