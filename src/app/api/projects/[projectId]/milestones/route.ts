import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  successResponse,
  handleUnsupportedMethod,
  parseZodError,
  ApiErrors,
  HTTP_STATUS,
} from "@/lib/utils/api-response"
import { withAdminOrProjectRole } from "@/lib/utils/api-route-helper"
import { createMilestoneSchema } from "@/lib/validations/milestone"
import { auditLog } from "@/lib/utils/audit"

type Params = { projectId: string }

export const GET = withAdminOrProjectRole<Params>("CONTRIBUTOR", async (_actor, _request: NextRequest, params) => {
  const { projectId } = params!

  const milestones = await prisma.milestone.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { dueDate: "asc" },
    include: {
      _count: { select: { tasks: { where: { deletedAt: null } } } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  return successResponse(milestones)
})

export const POST = withAdminOrProjectRole<Params>("MANAGER", async (actor, request: NextRequest, params) => {
  const { projectId } = params!

  const body = await request.json()
  const validation = createMilestoneSchema.safeParse(body)

  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error))
  }

  const milestone = await prisma.milestone.create({
    data: {
      ...validation.data,
      dueDate: new Date(validation.data.dueDate),
      projectId,
      createdById: actor.id,
    },
  })

  await auditLog({ entityType: "Milestone", entityId: milestone.id, action: "CREATE", actorId: actor.id, newData: milestone })

  return successResponse(milestone, "Milestone created", HTTP_STATUS.CREATED)
})

export async function PUT() { return handleUnsupportedMethod(["GET", "POST"]) }
export async function DELETE() { return handleUnsupportedMethod(["GET", "POST"]) }
export async function PATCH() { return handleUnsupportedMethod(["GET", "POST"]) }
