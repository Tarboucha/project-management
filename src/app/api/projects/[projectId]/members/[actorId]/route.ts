import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  successResponse,
  handleUnsupportedMethod,
  parseZodError,
  ApiErrors,
} from "@/lib/utils/api-response"
import { withAdminOrProjectRole } from "@/lib/utils/api-route-helper"
import { updateProjectMemberSchema } from "@/lib/validations/project"
import { auditLog } from "@/lib/utils/audit"

type Params = { projectId: string; actorId: string }

export const PATCH = withAdminOrProjectRole<Params>("DIRECTOR", async (currentActor, request: NextRequest, params) => {
  const { projectId, actorId } = params!

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_actorId: { projectId, actorId } },
  })
  if (!existing) {
    return ApiErrors.notFound("Member")
  }

  const body = await request.json()
  const validation = updateProjectMemberSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  const member = await prisma.projectMember.update({
    where: { projectId_actorId: { projectId, actorId } },
    data: { role: validation.data.role },
    include: {
      actor: {
        select: { id: true, firstName: true, lastName: true, email: true, systemRole: true },
      },
    },
  })

  await auditLog({ entityType: "ProjectMember", entityId: actorId, action: "UPDATE", actorId: currentActor.id, oldData: existing, newData: member })

  return successResponse(member, "Member role updated")
})

export const DELETE = withAdminOrProjectRole<Params>("MANAGER", async (actor, _request: NextRequest, params, projectRole) => {
  const { projectId, actorId } = params!

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_actorId: { projectId, actorId } },
  })
  if (!existing) {
    return ApiErrors.notFound("Member")
  }

  // Role-based check: MANAGER can only remove CONTRIBUTORs
  if (projectRole === "MANAGER" && existing.role !== "CONTRIBUTOR") {
    return ApiErrors.forbidden("Managers can only remove contributors")
  }

  await prisma.projectMember.delete({
    where: { projectId_actorId: { projectId, actorId } },
  })

  await auditLog({ entityType: "ProjectMember", entityId: actorId, action: "DELETE", actorId: actor.id, oldData: existing })

  return successResponse(null, "Member removed")
})

export async function GET() { return handleUnsupportedMethod(["PATCH", "DELETE"]) }
export async function POST() { return handleUnsupportedMethod(["PATCH", "DELETE"]) }
export async function PUT() { return handleUnsupportedMethod(["PATCH", "DELETE"]) }
