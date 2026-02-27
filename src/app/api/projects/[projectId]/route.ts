import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  successResponse,
  handleUnsupportedMethod,
  parseZodError,
  ApiErrors,
} from "@/lib/utils/api-response"
import { withAdmin, withAdminOrProjectRole } from "@/lib/utils/api-route-helper"
import { updateProjectSchema } from "@/lib/validations/project"
import { auditLog } from "@/lib/utils/audit"

type Params = { projectId: string }

export const GET = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (_actor, _request: NextRequest, params) => {
  const { projectId } = params!

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      program: { select: { id: true, name: true } },
      activity: { select: { id: true, name: true } },
      theme: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      members: {
        include: {
          actor: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      _count: {
        select: {
          tasks: { where: { deletedAt: null } },
          milestones: { where: { deletedAt: null } },
        },
      },
    },
  })

  if (!project || project.deletedAt) {
    return ApiErrors.notFound("Project")
  }

  return successResponse(project)
})

export const PATCH = withAdminOrProjectRole<Params>("MANAGER", async (actor, request: NextRequest, params) => {
  const { projectId } = params!

  const existing = await prisma.project.findUnique({ where: { id: projectId } })
  if (!existing || existing.deletedAt) {
    return ApiErrors.notFound("Project")
  }

  const body = await request.json()
  const validation = updateProjectSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  const updateData: Record<string, unknown> = {
    ...validation.data,
    version: { increment: 1 },
    modifiedAt: new Date(),
  }

  if (validation.data.startDate) {
    updateData.startDate = new Date(validation.data.startDate)
  }
  if (validation.data.endDate) {
    updateData.endDate = new Date(validation.data.endDate)
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data: updateData,
  })

  await auditLog({ entityType: "Project", entityId: projectId, action: "UPDATE", actorId: actor.id, oldData: existing, newData: project, version: project.version })

  return successResponse(project, "Project updated")
})

export const DELETE = withAdmin<Params>(async (actor, _request: NextRequest, params) => {
  const { projectId } = params!

  const existing = await prisma.project.findUnique({ where: { id: projectId } })
  if (!existing || existing.deletedAt) {
    return ApiErrors.notFound("Project")
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data: { deletedAt: new Date(), modifiedAt: new Date() },
  })

  await auditLog({ entityType: "Project", entityId: projectId, action: "DELETE", actorId: actor.id, oldData: existing })

  return successResponse(project, "Project deleted")
})

export async function PUT() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
export async function POST() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]) }
