import { NextRequest } from "next/server"
import { withRLS } from "@/lib/prisma/rls"
import {
  successResponse,
  handleUnsupportedMethod,
  parseZodError,
  ApiErrors,
} from "@/lib/utils/api-response"
import { withAdminOrProjectRole } from "@/lib/utils/api-route-helper"
import { updateProjectMemberSchema } from "@/lib/validations/project"

type Params = { projectId: string; actorId: string }

export const PATCH = withAdminOrProjectRole<Params>("DIRECTOR", async (currentActor, request: NextRequest, params) => {
  const { projectId, actorId } = params!

  const body = await request.json()
  const validation = updateProjectMemberSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  const member = await withRLS(currentActor, async (db) => {
    const existing = await db.projectMember.findUnique({
      where: { projectId_actorId: { projectId, actorId } },
    })
    if (!existing || existing.deletedAt) {
      return ApiErrors.notFound("Member")
    }

    return db.projectMember.update({
      where: { projectId_actorId: { projectId, actorId } },
      data: { role: validation.data.role },
      include: {
        actor: {
          select: { id: true, firstName: true, lastName: true, email: true, systemRole: true },
        },
      },
    })
  })

  if (member instanceof Response) {
    return member
  }

  return successResponse(member, "Member role updated")
})

export const DELETE = withAdminOrProjectRole<Params>("MANAGER", async (actor, _request: NextRequest, params, projectRole) => {
  const { projectId, actorId } = params!

  const result = await withRLS(actor, async (db) => {
    const existing = await db.projectMember.findUnique({
      where: { projectId_actorId: { projectId, actorId } },
    })
    if (!existing || existing.deletedAt) {
      return ApiErrors.notFound("Member")
    }

    // Role-based check: MANAGER can only remove CONTRIBUTORs
    if (projectRole === "MANAGER" && existing.role !== "CONTRIBUTOR") {
      return ApiErrors.forbidden("Managers can only remove contributors")
    }

    return db.projectMember.update({
      where: { projectId_actorId: { projectId, actorId } },
      data: { deletedAt: new Date() },
    })
  })

  if (result instanceof Response) {
    return result
  }

  return successResponse(null, "Member removed")
})

export async function GET() { return handleUnsupportedMethod(["PATCH", "DELETE"]) }
export async function POST() { return handleUnsupportedMethod(["PATCH", "DELETE"]) }
export async function PUT() { return handleUnsupportedMethod(["PATCH", "DELETE"]) }
