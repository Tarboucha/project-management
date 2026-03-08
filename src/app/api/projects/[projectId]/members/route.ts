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
import { addProjectMemberSchema } from "@/lib/validations/project"
import type { ProjectRole } from "@/generated/prisma/client"

type Params = { projectId: string }

export const GET = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (actor, _request: NextRequest, params) => {
  const { projectId } = params!

  return withRLS(actor, async (db) => {
    const members = await db.projectMember.findMany({
      where: { projectId, deletedAt: null },
      include: {
        actor: {
          select: { id: true, firstName: true, lastName: true, email: true, systemRole: true },
        },
      },
      orderBy: { assignedAt: "asc" },
    })

    return successResponse(members)
  })
})

export const POST = withAdminOrProjectRole<Params>("MANAGER", async (actor, request: NextRequest, params, projectRole) => {
  const { projectId } = params!

  const body = await request.json()
  const validation = addProjectMemberSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  const { email, role } = validation.data

  // Role-based check: MANAGER can only add CONTRIBUTOR
  if (projectRole === "MANAGER" && role !== "CONTRIBUTOR") {
    return ApiErrors.forbidden("Managers can only add contributors")
  }

  const member = await withRLS(actor, async (db) => {
    // Look up actor by email
    const targetActor = await db.actor.findUnique({ where: { email } })
    if (!targetActor || targetActor.deletedAt) {
      return ApiErrors.notFound("User with this email")
    }

    const actorId = targetActor.id

    // Check not already a member
    const existingMember = await db.projectMember.findUnique({
      where: { projectId_actorId: { projectId, actorId } },
    })
    if (existingMember && !existingMember.deletedAt) {
      return ApiErrors.conflict("Actor is already a member of this project")
    }

    return db.projectMember.create({
      data: {
        projectId,
        actorId,
        role: role as ProjectRole,
      },
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

  return successResponse(member, "Member added", HTTP_STATUS.CREATED)
})

export async function PUT() { return handleUnsupportedMethod(["GET", "POST"]) }
export async function DELETE() { return handleUnsupportedMethod(["GET", "POST"]) }
export async function PATCH() { return handleUnsupportedMethod(["GET", "POST"]) }
