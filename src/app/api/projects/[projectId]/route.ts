import { NextRequest } from "next/server"
import { withRLS } from "@/lib/prisma/rls"
import {
  successResponse,
  handleUnsupportedMethod,
  parseZodError,
  ApiErrors,
} from "@/lib/utils/api-response"
import { withAdmin, withAdminOrProjectRole } from "@/lib/utils/api-route-helper"
import { updateProjectSchema } from "@/lib/validations/project"
type Params = { projectId: string }

export const GET = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (actor, _request: NextRequest, params) => {
  const { projectId } = params!

  return withRLS(actor, async (db) => {
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        program: { select: { id: true, name: true } },
        activity: { select: { id: true, name: true } },
        theme: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        members: {
          where: { deletedAt: null },
          include: {
            actor: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        _count: {
          select: {
            tasks: { where: { deletedAt: null } },
          },
        },
      },
    })

    if (!project || project.deletedAt) {
      return ApiErrors.notFound("Project")
    }

    return successResponse(project)
  })
})

export const PATCH = withAdminOrProjectRole<Params>("MANAGER", async (actor, request: NextRequest, params) => {
  const { projectId } = params!

  const body = await request.json()
  const validation = updateProjectSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  const result = await withRLS(actor, async (db) => {
    const existing = await db.project.findUnique({ where: { id: projectId } })
    if (!existing || existing.deletedAt) {
      return ApiErrors.notFound("Project")
    }

    const updateData: Record<string, unknown> = {
      ...validation.data,
      version: { increment: 1 },
    }

    if (validation.data.startDate) {
      updateData.startDate = new Date(validation.data.startDate)
    }
    if (validation.data.endDate) {
      updateData.endDate = new Date(validation.data.endDate)
    }

    return db.project.update({
      where: { id: projectId },
      data: updateData,
    })
  })

  if (result instanceof Response) {
    return result
  }

  return successResponse(result, "Project updated")
})

export const DELETE = withAdmin<Params>(async (actor, _request: NextRequest, params) => {
  const { projectId } = params!

  const result = await withRLS(actor, async (db) => {
    const existing = await db.project.findUnique({ where: { id: projectId } })
    if (!existing || existing.deletedAt) {
      return ApiErrors.notFound("Project")
    }

    return db.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    })
  })

  if (result instanceof Response) {
    return result
  }

  return successResponse(result, "Project deleted")
})

export async function PUT() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
export async function POST() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
